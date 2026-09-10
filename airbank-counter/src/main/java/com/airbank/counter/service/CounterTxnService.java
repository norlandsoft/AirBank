package com.airbank.counter.service;

import com.airbank.common.api.PageResult;
import com.airbank.common.exception.BizException;
import com.airbank.common.exception.ErrorCodes;
import com.airbank.common.security.AuthContext;
import com.airbank.counter.config.CounterParams;
import com.airbank.counter.entity.CounterTxn;
import com.airbank.counter.entity.TellerShift;
import com.airbank.counter.mapper.CounterTxnMapper;
import com.airbank.counter.mapper.SeqMapper;
import com.airbank.counter.model.CtVO;
import com.airbank.counter.model.TxnAcceptCmd;
import com.airbank.counter.strategy.BizStrategyRegistry;
import com.airbank.counter.strategy.BizTypeStrategy;
import com.airbank.counter.strategy.CashDirection;
import com.airbank.counter.strategy.ExecContext;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.SplittableRandom;
import java.util.Set;

/**
 * 柜面统一受理核心（docs/design/05 §2.2 状态机 + 授权矩阵）：
 * 受理（幂等 request_no）→ 授权判定 → 直接执行 / 挂起待复核 → 执行（策略分发下游 Feign）→ POSTED/FAILED → 回执。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CounterTxnService {

    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final DateTimeFormatter TS = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
    private static final SplittableRandom RANDOM = new SplittableRandom();

    /** 金额 ≥ authorizeThreshold 需主管授权 */
    private static final Set<String> AMOUNT_AUTH_TYPES = Set.of(
            CounterTxn.BIZ_CASH_DEPOSIT, CounterTxn.BIZ_CASH_WITHDRAW, CounterTxn.BIZ_INNER_TRANSFER,
            CounterTxn.BIZ_WEALTH_SUBSCRIBE, CounterTxn.BIZ_TIME_DEPOSIT_IN);

    /** 一律需主管授权 */
    private static final Set<String> ALWAYS_AUTH_TYPES = Set.of(
            CounterTxn.BIZ_ACCOUNT_FREEZE, CounterTxn.BIZ_ACCOUNT_UNFREEZE,
            CounterTxn.BIZ_ACCOUNT_CLOSE, CounterTxn.BIZ_REVERSE);

    /** 金额类业务（amount 必须 > 0） */
    private static final Set<String> AMOUNT_BEARING_TYPES = Set.of(
            CounterTxn.BIZ_ACCOUNT_OPEN, CounterTxn.BIZ_CASH_DEPOSIT, CounterTxn.BIZ_CASH_WITHDRAW,
            CounterTxn.BIZ_INNER_TRANSFER, CounterTxn.BIZ_TIME_DEPOSIT_IN,
            CounterTxn.BIZ_WEALTH_SUBSCRIBE, CounterTxn.BIZ_WEALTH_REDEEM);

    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {
    };

    private final CounterTxnMapper txnMapper;
    private final SeqMapper seqMapper;
    private final ShiftService shiftService;
    private final CashBoxService cashBoxService;
    private final VoucherService voucherService;
    private final BizStrategyRegistry registry;
    private final CounterParams params;
    private final ObjectMapper objectMapper;

    /** 统一受理：返回申请单视图（PENDING_REVIEW 挂起 / POSTED 成功 / FAILED 失败可重发） */
    public CtVO accept(TxnAcceptCmd cmd) {
        if (cmd == null || cmd.getBizType() == null || cmd.getBizType().isBlank()) {
            throw BizException.of(ErrorCodes.PARAM_INVALID, "缺少 bizType");
        }
        String bizType = cmd.getBizType();
        if (!registry.supports(bizType)) {
            throw BizException.of(ErrorCodes.PARAM_INVALID, "不支持的 bizType: " + bizType);
        }
        TellerShift shift = shiftService.requireOpenShift(shiftService.requireTellerNo());

        // 幂等：同 request_no 重复受理直接返回原单
        if (cmd.getRequestNo() != null && !cmd.getRequestNo().isBlank()) {
            CounterTxn exist = txnMapper.selectOne(new LambdaQueryWrapper<CounterTxn>()
                    .eq(CounterTxn::getRequestNo, cmd.getRequestNo()));
            if (exist != null) {
                return CtVO.of(exist);
            }
        }

        validate(bizType, cmd);
        long amount = cmd.getAmount() == null ? 0L : cmd.getAmount();

        // 冲正仅限当日本人交易（5008）：能匹配到柜面 POSTED 原单时校验受理人/日期
        if (CounterTxn.BIZ_REVERSE.equals(bizType) && cmd.getTxnNo() != null) {
            CounterTxn orig = findPostedByResultTxnNo(cmd.getTxnNo());
            if (orig != null && (!LocalDate.now().equals(orig.getShiftDate())
                    || !shift.getTellerNo().equals(orig.getTellerNo()))) {
                throw BizException.of(ErrorCodes.REVERSE_DENY, "冲正仅限当日本人交易");
            }
        }

        CounterTxn txn = new CounterTxn();
        txn.setCtNo(nextCtNo());
        txn.setBizType(bizType);
        txn.setPayload(toPayloadMap(cmd));
        txn.setAmount(amount);
        txn.setStatus(needAuthorize(bizType, amount)
                ? CounterTxn.ST_PENDING_REVIEW : CounterTxn.ST_EXECUTING);
        txn.setTellerNo(shift.getTellerNo());
        txn.setBranchNo(shift.getBranchNo());
        txn.setShiftDate(LocalDate.now());
        txn.setRequestNo(cmd.getRequestNo() == null || cmd.getRequestNo().isBlank()
                ? genRequestNo() : cmd.getRequestNo());
        txnMapper.insert(txn);

        if (CounterTxn.ST_PENDING_REVIEW.equals(txn.getStatus())) {
            return CtVO.of(txn);
        }
        return executeAndFinish(txn);
    }

    /** 当日 FAILED 单据用原 request_no 重发；POSTED 不可重发（5004） */
    public CtVO retry(Long id) {
        shiftService.requireOpenShift(shiftService.requireTellerNo());
        CounterTxn txn = txnMapper.selectById(id);
        if (txn == null) {
            throw BizException.of(ErrorCodes.NOT_FOUND, "申请单不存在");
        }
        if (CounterTxn.ST_POSTED.equals(txn.getStatus())) {
            throw BizException.of(ErrorCodes.CT_STATUS_DENY, "该单据已记账，不可重发");
        }
        if (!CounterTxn.ST_FAILED.equals(txn.getStatus())) {
            throw BizException.of(ErrorCodes.CT_STATUS_DENY, "仅失败单据可重发");
        }
        if (!LocalDate.now().equals(txn.getShiftDate())) {
            throw BizException.of(ErrorCodes.CT_STATUS_DENY, "仅限当日单据可重发");
        }
        txn.setStatus(CounterTxn.ST_EXECUTING);
        txnMapper.updateById(txn);
        return executeAndFinish(txn);
    }

    public PageResult<CtVO> page(String status, boolean mine, int pageNum, int pageSize) {
        String tellerNo = shiftService.requireTellerNo();
        LambdaQueryWrapper<CounterTxn> qw = new LambdaQueryWrapper<CounterTxn>()
                .orderByDesc(CounterTxn::getId);
        if (status != null && !status.isBlank()) {
            qw.eq(CounterTxn::getStatus, status);
        }
        if (mine) {
            qw.eq(CounterTxn::getTellerNo, tellerNo);
        }
        Page<CounterTxn> page = txnMapper.selectPage(new Page<>(pageNum, pageSize), qw);
        List<CtVO> list = page.getRecords().stream().map(CtVO::of).toList();
        return new PageResult<>(list, page.getTotal(), pageNum, pageSize);
    }

    /**
     * 执行并落终态：前置尾箱校验 → 策略执行下游 → 尾箱记账 → POSTED+回执；
     * 任一环节 BizException → FAILED + fail_reason（错误码透传）。
     */
    public CtVO executeAndFinish(CounterTxn txn) {
        BizTypeStrategy strategy = registry.of(txn.getBizType());
        Map<String, Object> payload = txn.getPayload() == null ? Map.of() : txn.getPayload();
        ExecContext ctx = new ExecContext(txn, payload, txn.getRequestNo(), txn.getTellerNo(), txn.getBranchNo());
        CashDirection direction = strategy.cashDirection();
        long amount = txn.getAmount() == null ? 0L : txn.getAmount();
        try {
            if (direction != null && amount > 0) {
                cashBoxService.precheck(txn.getTellerNo(), txn.getShiftDate(), direction, amount);
            }
            Map<String, Object> result = strategy.execute(ctx);
            if (direction != null && amount > 0) {
                if (direction == CashDirection.IN) {
                    cashBoxService.cashIn(txn.getTellerNo(), txn.getShiftDate(), txn.getBizType(), txn.getId(), amount);
                } else {
                    cashBoxService.cashOut(txn.getTellerNo(), txn.getShiftDate(), txn.getBizType(), txn.getId(), amount);
                }
            }
            txn.setStatus(CounterTxn.ST_POSTED);
            txn.setResult(result);
            txnMapper.updateById(txn);
            voucherService.generate(txn);
            if (CounterTxn.BIZ_REVERSE.equals(txn.getBizType())) {
                markReversedOriginal(txn);
            }
            log.info("counter txn POSTED: ctNo={} bizType={} amount={} requestNo={}",
                    txn.getCtNo(), txn.getBizType(), amount, txn.getRequestNo());
        } catch (BizException e) {
            log.warn("counter txn FAILED: ctNo={} code={} msg={}", txn.getCtNo(), e.getCode(), e.getMessage());
            txn.setStatus(CounterTxn.ST_FAILED);
            txn.setFailReason(abbreviate(e.getCode() + ": " + e.getMessage()));
            txnMapper.updateById(txn);
        }
        return CtVO.of(txn);
    }

    // ==================== 私有辅助 ====================

    /** 授权矩阵（Nacos airbank.params.authorize-threshold 可热改） */
    private boolean needAuthorize(String bizType, long amount) {
        if (ALWAYS_AUTH_TYPES.contains(bizType)) {
            return true;
        }
        return AMOUNT_AUTH_TYPES.contains(bizType) && amount >= params.getAuthorizeThreshold();
    }

    private void validate(String bizType, TxnAcceptCmd cmd) {
        long amount = cmd.getAmount() == null ? 0L : cmd.getAmount();
        if (AMOUNT_BEARING_TYPES.contains(bizType) && amount <= 0) {
            throw BizException.of(ErrorCodes.PARAM_INVALID, "金额必须大于 0");
        }
        switch (bizType) {
            case CounterTxn.BIZ_ACCOUNT_OPEN -> {
                if (cmd.getCustomerId() == null && (cmd.getCustomerCmd() == null || cmd.getCustomerCmd().isEmpty())) {
                    throw BizException.of(ErrorCodes.PARAM_INVALID, "开户缺少 customerId 或 customerCmd");
                }
            }
            case CounterTxn.BIZ_CASH_DEPOSIT, CounterTxn.BIZ_CASH_WITHDRAW,
                 CounterTxn.BIZ_ACCOUNT_FREEZE, CounterTxn.BIZ_ACCOUNT_UNFREEZE,
                 CounterTxn.BIZ_ACCOUNT_CLOSE -> requireText(cmd.getAcctNo(), "缺少账号 acctNo");
            case CounterTxn.BIZ_INNER_TRANSFER -> {
                requireText(cmd.getAcctNo(), "缺少付款账号 acctNo");
                requireText(cmd.getToAcct(), "缺少收款账号 toAcct");
                if (cmd.getAcctNo().equals(cmd.getToAcct())) {
                    throw BizException.of(ErrorCodes.PARAM_INVALID, "收付双方必须为不同账号");
                }
            }
            case CounterTxn.BIZ_TIME_DEPOSIT_IN -> {
                requireText(cmd.getAcctNo(), "缺少账号 acctNo");
                if (cmd.getTermMonths() == null) {
                    throw BizException.of(ErrorCodes.PARAM_INVALID, "缺少存期 termMonths");
                }
            }
            case CounterTxn.BIZ_TIME_DEPOSIT_BREAK -> requireText(cmd.getDepositNo(), "缺少存单号 depositNo");
            case CounterTxn.BIZ_WEALTH_SUBSCRIBE, CounterTxn.BIZ_WEALTH_REDEEM -> {
                if (cmd.getCustomerId() == null) {
                    throw BizException.of(ErrorCodes.PARAM_INVALID, "缺少 customerId");
                }
                requireText(cmd.getAcctNo(), "缺少账号 acctNo");
                requireText(cmd.getProductCode(), "缺少产品代码 productCode");
            }
            case CounterTxn.BIZ_REVERSE -> requireText(cmd.getTxnNo(), "缺少被冲正流水号 txnNo");
            default -> throw BizException.of(ErrorCodes.PARAM_INVALID, "不支持的 bizType: " + bizType);
        }
    }

    private void requireText(String v, String msg) {
        if (v == null || v.isBlank()) {
            throw BizException.of(ErrorCodes.PARAM_INVALID, msg);
        }
    }

    /** CT + yyyyMMdd + 8 位序列（seq_ct） */
    private String nextCtNo() {
        return "CT" + LocalDate.now().format(DAY) + String.format("%08d", seqMapper.nextval("seq_ct") % 100_000_000L);
    }

    private String genRequestNo() {
        return "CTREQ" + LocalDateTime.now().format(TS) + String.format("%05d", RANDOM.nextInt(100_000));
    }

    private Map<String, Object> toPayloadMap(TxnAcceptCmd cmd) {
        Map<String, Object> raw = objectMapper.convertValue(cmd, MAP_TYPE);
        Map<String, Object> payload = new LinkedHashMap<>();
        for (Map.Entry<String, Object> e : raw.entrySet()) {
            if (e.getValue() != null) {
                payload.put(e.getKey(), e.getValue());
            }
        }
        return payload;
    }

    /** 按核心流水号定位柜面 POSTED 原单（result->>'txnNo'） */
    private CounterTxn findPostedByResultTxnNo(String txnNo) {
        return txnMapper.selectOne(new LambdaQueryWrapper<CounterTxn>()
                .eq(CounterTxn::getStatus, CounterTxn.ST_POSTED)
                .apply("result->>'txnNo' = {0}", txnNo)
                .last("LIMIT 1"));
    }

    /** 冲正成功后在原单留痕 reversed_by */
    private void markReversedOriginal(CounterTxn reverseTxn) {
        String origTxnNo = reverseTxn.getPayload() == null ? null
                : (String) reverseTxn.getPayload().get("txnNo");
        if (origTxnNo == null || origTxnNo.isBlank()) {
            return;
        }
        CounterTxn orig = findPostedByResultTxnNo(origTxnNo);
        if (orig != null) {
            orig.setReversedBy(reverseTxn.getId());
            txnMapper.updateById(orig);
        }
    }

    private String abbreviate(String s) {
        if (s == null) {
            return null;
        }
        return s.length() <= 256 ? s : s.substring(0, 256);
    }

    /** 供日结/看板使用 */
    public long sumPostedAmount(String tellerNo, LocalDate date) {
        return txnMapper.sumPostedAmount(tellerNo, date);
    }

    public long countPosted(String tellerNo, LocalDate date) {
        return txnMapper.selectCount(new LambdaQueryWrapper<CounterTxn>()
                .eq(CounterTxn::getStatus, CounterTxn.ST_POSTED)
                .eq(CounterTxn::getTellerNo, tellerNo)
                .eq(CounterTxn::getShiftDate, date));
    }

    public List<CounterTxn> listPosted(String tellerNo, LocalDate date) {
        return txnMapper.selectList(new LambdaQueryWrapper<CounterTxn>()
                .eq(CounterTxn::getStatus, CounterTxn.ST_POSTED)
                .eq(CounterTxn::getTellerNo, tellerNo)
                .eq(CounterTxn::getShiftDate, date)
                .orderByAsc(CounterTxn::getId));
    }

    public long countPendingReview() {
        return txnMapper.countPendingReview();
    }

    /** 按 shiftDate 查询（回执列表用） */
    public List<CounterTxn> listByDate(LocalDate date) {
        return txnMapper.selectList(new LambdaQueryWrapper<CounterTxn>()
                .eq(CounterTxn::getShiftDate, date));
    }

    public CounterTxn byId(Long id) {
        return txnMapper.selectById(id);
    }

    /** 日结借贷分类（柜面口径）：付款（借）方向 */
    public boolean isDebit(String bizType) {
        return Set.of(CounterTxn.BIZ_CASH_WITHDRAW, CounterTxn.BIZ_INNER_TRANSFER,
                CounterTxn.BIZ_WEALTH_REDEEM, CounterTxn.BIZ_TIME_DEPOSIT_BREAK).contains(bizType);
    }

    /** 日结借贷分类：收款（贷）方向 */
    public boolean isCredit(String bizType) {
        return Set.of(CounterTxn.BIZ_CASH_DEPOSIT, CounterTxn.BIZ_ACCOUNT_OPEN,
                CounterTxn.BIZ_TIME_DEPOSIT_IN, CounterTxn.BIZ_WEALTH_SUBSCRIBE).contains(bizType);
    }

    /** 现金流入类业务 */
    public boolean isCashIn(String bizType) {
        return CounterTxn.BIZ_CASH_DEPOSIT.equals(bizType) || CounterTxn.BIZ_ACCOUNT_OPEN.equals(bizType);
    }

    /** 现金流出处业务 */
    public boolean isCashOut(String bizType) {
        return CounterTxn.BIZ_CASH_WITHDRAW.equals(bizType);
    }
}
