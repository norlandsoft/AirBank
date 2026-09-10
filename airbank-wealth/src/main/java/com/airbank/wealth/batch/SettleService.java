package com.airbank.wealth.batch;

import com.airbank.api.core.CoreClient;
import com.airbank.api.core.dto.TxnCmd;
import com.airbank.api.core.dto.TxnVO;
import com.airbank.common.api.Result;
import com.airbank.common.exception.BizException;
import com.airbank.common.exception.ErrorCodes;
import com.airbank.wealth.entity.Position;
import com.airbank.wealth.entity.Product;
import com.airbank.wealth.entity.SettlementBatch;
import com.airbank.wealth.entity.SettlementInstruction;
import com.airbank.wealth.entity.WealthOrder;
import com.airbank.wealth.mapper.PositionMapper;
import com.airbank.wealth.mapper.ProductMapper;
import com.airbank.wealth.mapper.SettlementBatchMapper;
import com.airbank.wealth.mapper.SettlementInstructionMapper;
import com.airbank.wealth.mapper.WealthOrderMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * 清算批量（docs/design/04 §3/§6）：
 * 1) 赎回兑付：REDEEMING 且 confirm_date ≤ batchDate 的订单 → 按比例结转收益，
 *    核心 WEALTH_REDEEM（本金 2061→2011）+ WEALTH_INCOME（收益 6012→2011）→ SETTLED；
 * 2) 到期清算：RUNNING 且 maturity_date ≤ batchDate → SETTLING → 逐持仓生成清算指令（request_no 幂等）
 *    → 核心入账 → 指令 DONE、持仓清零 → 全部完成后产品 CLOSED + SettlementBatch 汇总。
 * 单笔入账失败仅记日志并继续（订单/指令保持原状，批量幂等重跑补齐）。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SettleService {

    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("yyyyMMdd");

    private final WealthOrderMapper orderMapper;
    private final ProductMapper productMapper;
    private final PositionMapper positionMapper;
    private final SettlementBatchMapper batchMapper;
    private final SettlementInstructionMapper instructionMapper;
    private final CoreClient coreClient;
    private final StringRedisTemplate redis;

    @Scheduled(cron = "${airbank.params.settle-cron:0 50 23 * * ?}")
    public void scheduled() {
        try {
            trigger(LocalDate.now());
        } catch (Exception e) {
            log.warn("[settle] scheduled failed: {}", e.getMessage());
        }
    }

    /** 手动/内部触发入口（含赎回兑付与到期清算） */
    public String trigger(LocalDate batchDate) {
        String lockKey = "lock:batch:SETTLE:" + batchDate;
        Boolean locked = redis.opsForValue().setIfAbsent(lockKey, "1", Duration.ofMinutes(30));
        if (!Boolean.TRUE.equals(locked)) {
            throw BizException.of(ErrorCodes.BATCH_RUNNING, "清算批量正在执行或锁占用中（30 分钟后自动释放）");
        }
        try {
            int redeemed = settleRedeems(batchDate);
            int closed = matureProducts(batchDate);
            String msg = "settle done: redeemed=" + redeemed + ", products-closed=" + closed;
            log.info("[settle] {} {}", batchDate, msg);
            return msg;
        } finally {
            redis.delete(lockKey);
        }
    }

    // ---------- 1. 赎回兑付 ----------

    /** REDEEMING → SETTLED；持仓扣减/清零；收益按比例结转（floor） */
    @Transactional
    public int settleRedeems(LocalDate batchDate) {
        List<WealthOrder> orders = orderMapper.selectList(new LambdaQueryWrapper<WealthOrder>()
                .eq(WealthOrder::getStatus, WealthOrder.ST_REDEEMING)
                .le(WealthOrder::getConfirmDate, batchDate));
        int n = 0;
        for (WealthOrder o : orders) {
            try {
                settleOneRedeem(o);
                n++;
            } catch (BizException e) {
                // 订单保持 REDEEMING，批量重跑（核心幂等保证重放安全）
                log.warn("[settle] redeem {} posting failed, keep REDEEMING: {}", o.getOrderNo(), e.getMessage());
            }
        }
        return n;
    }

    private void settleOneRedeem(WealthOrder o) {
        Position pos = positionMapper.selectOne(new LambdaQueryWrapper<Position>()
                .eq(Position::getCustomerId, o.getCustomerId())
                .eq(Position::getProductId, o.getProductId()));
        if (pos == null) {
            log.warn("[settle] redeem {} position missing, skip", o.getOrderNo());
            return;
        }
        BigDecimal redeemShares = o.getShares() == null
                ? BigDecimal.valueOf(o.getAmount()).movePointLeft(2).setScale(2, RoundingMode.HALF_UP)
                : o.getShares();
        if (pos.getTotalShares().compareTo(BigDecimal.ZERO) <= 0) {
            log.warn("[settle] redeem {} position shares zero, skip", o.getOrderNo());
            return;
        }
        // 收益按比例结转：floor(accruing × redeemShares / totalShares)
        long income = BigDecimal.valueOf(pos.getAccruingIncome())
                .multiply(redeemShares)
                .divide(pos.getTotalShares(), 0, RoundingMode.FLOOR)
                .longValue();
        long principal = o.getAmount();
        String operator = o.getOperator() == null ? "batch" : o.getOperator();

        TxnVO pTxn = postTxn(o.getConfirmDate(), new TxnCmd(o.getRequestNo() + "-P", "WEALTH_REDEEM", null,
                o.getAcctNo(), principal, "理财赎回 " + o.getOrderNo(), "BATCH", operator, null));
        o.setRedeemTxnNo(pTxn.txnNo());
        if (income > 0) {
            TxnVO iTxn = postTxn(o.getConfirmDate(), new TxnCmd(o.getRequestNo() + "-I", "WEALTH_INCOME", null,
                    o.getAcctNo(), income, "理财赎回收益 " + o.getOrderNo(), "BATCH", operator, null));
            o.setIncomeTxnNo(iTxn.txnNo());
        }

        o.setIncomeAmount(income);
        o.setStatus(WealthOrder.ST_SETTLED);
        orderMapper.updateById(o);
        positionMapper.update(null, new LambdaUpdateWrapper<Position>()
                .eq(Position::getId, pos.getId())
                .setSql("total_shares = total_shares - " + redeemShares.toPlainString())
                .setSql("frozen_shares = frozen_shares - " + redeemShares.toPlainString())
                .setSql("cost_amount = cost_amount - " + principal)
                .setSql("accruing_income = accruing_income - " + income)
                .setSql("paid_income = paid_income + " + income));
        log.info("[settle] redeem {} settled, principal={}, income={}", o.getOrderNo(), principal, income);
    }

    // ---------- 2. 到期清算 ----------

    /** 返回本轮 CLOSED 的产品数 */
    @Transactional
    public int matureProducts(LocalDate batchDate) {
        List<Product> due = productMapper.selectList(new LambdaQueryWrapper<Product>()
                .eq(Product::getStatus, Product.ST_RUNNING)
                .le(Product::getMaturityDate, batchDate));
        for (Product p : due) {
            p.setStatus(Product.ST_SETTLING);
            productMapper.updateById(p);
            log.info("[settle] product {} matured {} → SETTLING", p.getProductCode(), p.getMaturityDate());
        }
        int closed = 0;
        List<Product> settling = productMapper.selectList(new LambdaQueryWrapper<Product>()
                .eq(Product::getStatus, Product.ST_SETTLING));
        for (Product p : settling) {
            if (settleProduct(p, batchDate)) {
                closed++;
            }
        }
        return closed;
    }

    /** 单产品清算；全部指令 DONE 后 CLOSED + 汇总。返回是否本轮 CLOSED */
    private boolean settleProduct(Product p, LocalDate batchDate) {
        String batchNo = "STL:" + p.getProductCode() + ":" + batchDate.format(DAY);
        SettlementBatch batch = requireBatch(batchNo, p, batchDate);
        if (SettlementBatch.ST_SUCCESS.equals(batch.getStatus())) {
            return true; // 幂等：已完成
        }
        List<Position> positions = positionMapper.selectList(new LambdaQueryWrapper<Position>()
                .eq(Position::getProductId, p.getId()));
        for (Position pos : positions) {
            if (pos.getTotalShares().compareTo(BigDecimal.ZERO) <= 0 && !hasInstruction(batchNo, pos.getId())) {
                continue; // 无持仓且无历史指令
            }
            // 本金 + 累计全部收益，两条指令（request_no 幂等调核心）
            createAndPostInstruction(batchNo, pos, SettlementInstruction.TYPE_PRINCIPAL,
                    nz(pos.getCostAmount()), batchDate, p);
            createAndPostInstruction(batchNo, pos, SettlementInstruction.TYPE_INCOME,
                    nz(pos.getAccruingIncome()), batchDate, p);

            if (pos.getTotalShares().compareTo(BigDecimal.ZERO) > 0) {
                // 持仓清零 + 收益核转已付
                positionMapper.update(null, new LambdaUpdateWrapper<Position>()
                        .eq(Position::getId, pos.getId())
                        .set(Position::getTotalShares, BigDecimal.ZERO)
                        .set(Position::getCostAmount, 0L)
                        .set(Position::getAccruingIncome, 0L)
                        .setSql("paid_income = paid_income + " + nz(pos.getAccruingIncome())));
            }
            // 同客户同产品在途确认订单 → SETTLED（到期兑付完成）
            orderMapper.update(null, new LambdaUpdateWrapper<WealthOrder>()
                    .eq(WealthOrder::getCustomerId, pos.getCustomerId())
                    .eq(WealthOrder::getProductId, p.getId())
                    .eq(WealthOrder::getStatus, WealthOrder.ST_CONFIRMED)
                    .set(WealthOrder::getStatus, WealthOrder.ST_SETTLED));
        }
        long pending = instructionMapper.selectCount(new LambdaQueryWrapper<SettlementInstruction>()
                .eq(SettlementInstruction::getBatchNo, batchNo)
                .ne(SettlementInstruction::getStatus, SettlementInstruction.ST_DONE));
        if (pending > 0) {
            log.warn("[settle] product {} has {} pending instructions, keep SETTLING", p.getProductCode(), pending);
            return false;
        }
        // 汇总 + CLOSED
        List<SettlementInstruction> all = instructionMapper.selectList(new LambdaQueryWrapper<SettlementInstruction>()
                .eq(SettlementInstruction::getBatchNo, batchNo));
        long principalTotal = all.stream().filter(i -> SettlementInstruction.TYPE_PRINCIPAL.equals(i.getInstructionType()))
                .mapToLong(i -> nz(i.getAmount())).sum();
        long incomeTotal = all.stream().filter(i -> SettlementInstruction.TYPE_INCOME.equals(i.getInstructionType()))
                .mapToLong(i -> nz(i.getAmount())).sum();
        batch.setPrincipalTotal(principalTotal);
        batch.setIncomeTotal(incomeTotal);
        batch.setStatus(SettlementBatch.ST_SUCCESS);
        batchMapper.updateById(batch);
        p.setStatus(Product.ST_CLOSED);
        productMapper.updateById(p);
        log.info("[settle] product {} CLOSED, batchNo={}, principal={}, income={}",
                p.getProductCode(), batchNo, principalTotal, incomeTotal);
        return true;
    }

    private void createAndPostInstruction(String batchNo, Position pos, String type, long amount,
                                          LocalDate batchDate, Product p) {
        SettlementInstruction ins = findInstruction(batchNo, pos.getId(), type);
        if (ins == null) {
            ins = new SettlementInstruction();
            ins.setBatchNo(batchNo);
            ins.setPositionId(pos.getId());
            ins.setInstructionType(type);
            ins.setAmount(amount);
            ins.setRequestNo("STLI:" + batchNo + ":" + pos.getId() + ":" + type);
            ins.setStatus(SettlementInstruction.ST_NEW);
            try {
                instructionMapper.insert(ins);
            } catch (DuplicateKeyException e) {
                ins = findInstruction(batchNo, pos.getId(), type);
                if (ins == null) {
                    return;
                }
            }
        }
        if (SettlementInstruction.ST_DONE.equals(ins.getStatus())) {
            return; // 幂等：已入账
        }
        if (ins.getAmount() == null || ins.getAmount() <= 0) {
            // 金额为 0（如无收益）直接置 DONE，不产生 0 元分录
            ins.setStatus(SettlementInstruction.ST_DONE);
            instructionMapper.updateById(ins);
            return;
        }
        boolean principal = SettlementInstruction.TYPE_PRINCIPAL.equals(type);
        String txnType = principal ? "WEALTH_REDEEM" : "WEALTH_INCOME";
        String summary = principal ? "理财到期清算本金 " + p.getProductCode() : "理财到期清算收益 " + p.getProductCode();
        try {
            TxnVO txn = postTxn(batchDate, new TxnCmd(ins.getRequestNo(), txnType, null, pos.getAcctNo(),
                    ins.getAmount(), summary, "BATCH", "batch", null));
            ins.setTxnNo(txn.txnNo());
            ins.setStatus(SettlementInstruction.ST_DONE);
            instructionMapper.updateById(ins);
            log.info("[settle] instruction {} posted, txn={}", ins.getRequestNo(), txn.txnNo());
        } catch (BizException e) {
            ins.setStatus(SettlementInstruction.ST_FAILED);
            instructionMapper.updateById(ins);
            log.warn("[settle] instruction {} posting failed: {}", ins.getRequestNo(), e.getMessage());
        }
    }

    private SettlementBatch requireBatch(String batchNo, Product p, LocalDate batchDate) {
        SettlementBatch batch = batchMapper.selectOne(new LambdaQueryWrapper<SettlementBatch>()
                .eq(SettlementBatch::getBatchNo, batchNo));
        if (batch != null) {
            return batch;
        }
        batch = new SettlementBatch();
        batch.setBatchNo(batchNo);
        batch.setProductId(p.getId());
        batch.setBatchDate(batchDate);
        batch.setPrincipalTotal(0L);
        batch.setIncomeTotal(0L);
        batch.setStatus(SettlementBatch.ST_RUNNING);
        batch.setCreatedAt(java.time.LocalDateTime.now());
        try {
            batchMapper.insert(batch);
        } catch (DuplicateKeyException e) {
            return batchMapper.selectOne(new LambdaQueryWrapper<SettlementBatch>()
                    .eq(SettlementBatch::getBatchNo, batchNo));
        }
        return batch;
    }

    private SettlementInstruction findInstruction(String batchNo, Long positionId, String type) {
        return instructionMapper.selectOne(new LambdaQueryWrapper<SettlementInstruction>()
                .eq(SettlementInstruction::getBatchNo, batchNo)
                .eq(SettlementInstruction::getPositionId, positionId)
                .eq(SettlementInstruction::getInstructionType, type));
    }

    private boolean hasInstruction(String batchNo, Long positionId) {
        return instructionMapper.selectCount(new LambdaQueryWrapper<SettlementInstruction>()
                .eq(SettlementInstruction::getBatchNo, batchNo)
                .eq(SettlementInstruction::getPositionId, positionId)) > 0;
    }

    private TxnVO postTxn(LocalDate batchDate, TxnCmd cmd) {
        Result<TxnVO> r = coreClient.postTxn(batchDate == null ? null : batchDate.toString(), cmd);
        TxnVO txn = r == null ? null : r.getData();
        if (txn == null || txn.txnNo() == null) {
            throw BizException.of(ErrorCodes.PAY_FAILED, "核心入账未返回流水号: " + cmd.requestNo());
        }
        return txn;
    }

    private long nz(Long v) {
        return v == null ? 0L : v;
    }
}
