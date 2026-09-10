package com.airbank.wealth.service;

import com.airbank.api.core.CoreClient;
import com.airbank.api.core.dto.TxnCmd;
import com.airbank.api.core.dto.TxnVO;
import com.airbank.api.uam.UamClient;
import com.airbank.api.wealth.dto.OrderVO;
import com.airbank.api.wealth.dto.RedeemCmd;
import com.airbank.api.wealth.dto.SubscribeCmd;
import com.airbank.common.api.Result;
import com.airbank.common.exception.BizException;
import com.airbank.common.exception.ErrorCodes;
import com.airbank.common.security.AuthContext;
import com.airbank.common.security.AuthUser;
import com.airbank.common.util.Money;
import com.airbank.wealth.entity.Position;
import com.airbank.wealth.entity.Product;
import com.airbank.wealth.entity.WealthOrder;
import com.airbank.wealth.mapper.PositionMapper;
import com.airbank.wealth.mapper.ProductMapper;
import com.airbank.wealth.mapper.SeqMapper;
import com.airbank.wealth.mapper.WealthOrderMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 申赎订单服务（docs/design/04 §2/§3/§5）。
 * 申购：资金前置，下单即调核心 WEALTH_SUBSCRIBE 扣款（幂等 request_no），T+1 确认份额。
 * 赎回：存续期受理，冻结份额，T+1 清算批量兑付本息。
 * 一致性边界：BizException（含核心业务拒绝）→ 订单 PAY_FAILED 并原样上抛；
 * 其他异常（超时等）→ 订单保持 PAYING 上抛，由对账/批量修复。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OrderService {

    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final int FAIL_REASON_MAX = 256;

    private final WealthOrderMapper orderMapper;
    private final ProductMapper productMapper;
    private final PositionMapper positionMapper;
    private final ProductService productService;
    private final CoreClient coreClient;
    private final UamClient uamClient;
    private final SeqMapper seqMapper;

    /** 申购：校验 → 落单 PAYING → 核心扣款 → PAY_SUCCESS（资金前置） */
    public OrderVO subscribe(SubscribeCmd cmd) {
        requireCmd(cmd.requestNo(), cmd.customerId(), cmd.acctNo(), cmd.productCode());
        WealthOrder exist = byRequestNo(cmd.requestNo());
        if (exist != null) {
            return toVo(exist); // 幂等：重复请求返回原订单
        }
        Product p = productService.require(cmd.productCode());
        if (!Product.ST_ON_SALE.equals(p.getStatus())) {
            throw BizException.of(ErrorCodes.PRODUCT_NOT_ON_SALE,
                    "产品当前状态 " + p.getStatus() + "，不在募集期，不可申购");
        }
        checkRisk(p, cmd.customerId());
        checkAmount(p, cmd.amount());
        checkRaiseLimit(p, cmd.amount());

        WealthOrder order = new WealthOrder();
        order.setOrderNo(nextOrderNo());
        order.setRequestNo(cmd.requestNo());
        order.setOrderType(WealthOrder.TYPE_PURCHASE);
        order.setProductId(p.getId());
        order.setProductCode(p.getProductCode());
        order.setCustomerId(cmd.customerId());
        order.setAcctNo(cmd.acctNo());
        order.setAmount(cmd.amount());
        order.setIncomeAmount(0L);
        order.setStatus(WealthOrder.ST_PAYING);
        order.setConfirmDate(p.getValueDate()); // 确认日 = 产品成立日
        order.setChannel(orDefault(cmd.channel(), "EBANK"));
        order.setOperator(resolveOperator(cmd.operator()));
        try {
            orderMapper.insert(order);
        } catch (DuplicateKeyException e) {
            return toVo(byRequestNo(cmd.requestNo())); // request_no 唯一索引兜底
        }

        try {
            TxnVO txn = postTxn(null, new TxnCmd(cmd.requestNo(), "WEALTH_SUBSCRIBE", cmd.acctNo(), null,
                    cmd.amount(), "理财申购 " + p.getProductCode(), order.getChannel(), order.getOperator(), null),
                    "核心扣款未返回流水号");
            order.setStatus(WealthOrder.ST_PAY_SUCCESS);
            order.setPayTxnNo(txn.txnNo());
            orderMapper.updateById(order);
            addRaisedAmount(p, cmd.amount());
            log.info("[order] subscribe {} ok, txn={}, amount={}", order.getOrderNo(), txn.txnNo(), cmd.amount());
        } catch (BizException e) {
            // 核心明确拒绝（余额不足等）或下游异常应答：订单置失败并原样上抛
            order.setStatus(WealthOrder.ST_PAY_FAILED);
            order.setFailReason(truncate(e.getMessage()));
            orderMapper.updateById(order);
            throw e;
        }
        // 其他异常：订单保持 PAYING，直接上抛，等待对账/批量按 request_no 修复
        return toVo(order);
    }

    /** 赎回：产品 RUNNING + 可用份额充足 → 订单 REDEEMING + 冻结份额，T+1 清算 */
    public OrderVO redeem(RedeemCmd cmd) {
        requireCmd(cmd.requestNo(), cmd.customerId(), cmd.acctNo(), cmd.productCode());
        WealthOrder exist = byRequestNo(cmd.requestNo());
        if (exist != null) {
            return toVo(exist);
        }
        Product p = productService.require(cmd.productCode());
        if (!Product.ST_RUNNING.equals(p.getStatus())) {
            throw BizException.of(ErrorCodes.PRODUCT_NOT_RUNNING,
                    "产品当前状态 " + p.getStatus() + "，非存续期，不可赎回");
        }
        Position pos = positionMapper.selectOne(new LambdaQueryWrapper<Position>()
                .eq(Position::getCustomerId, cmd.customerId())
                .eq(Position::getProductId, p.getId()));
        if (pos == null || cmd.shares() <= 0) {
            throw BizException.of(ErrorCodes.SHARES_NOT_ENOUGH, "无可用持仓份额");
        }
        // cmd.shares 与"分"同刻度（1 份 = 1 元 = 100 分）
        BigDecimal shares = BigDecimal.valueOf(cmd.shares()).movePointLeft(2).setScale(2, RoundingMode.HALF_UP);
        long redeemShares = cmd.shares();
        BigDecimal available = pos.getTotalShares().subtract(pos.getFrozenShares());
        if (available.compareTo(BigDecimal.ZERO) <= 0 || available.compareTo(shares) < 0) {
            throw BizException.of(ErrorCodes.SHARES_NOT_ENOUGH,
                    "可用份额不足：可用 " + available.toPlainString() + " 份，申请 " + shares.toPlainString() + " 份");
        }
        // 部分赎回后不得低于起购份额，否则转全额（docs/design/04 §3）
        long remain = pos.getTotalShares().movePointRight(2).longValue() - redeemShares;
        long minShares = p.getMinAmount(); // 1 元 = 1 份，起购份额（分刻度）
        if (remain > 0 && remain < minShares) {
            log.info("[order] redeem remain {} below min shares {}, convert to full redemption", remain, minShares);
            redeemShares = pos.getTotalShares().movePointRight(2).longValueExact();
            shares = pos.getTotalShares().setScale(2, RoundingMode.HALF_UP);
        }

        WealthOrder order = new WealthOrder();
        order.setOrderNo(nextOrderNo());
        order.setRequestNo(cmd.requestNo());
        order.setOrderType(WealthOrder.TYPE_REDEEM);
        order.setProductId(p.getId());
        order.setProductCode(p.getProductCode());
        order.setCustomerId(cmd.customerId());
        order.setAcctNo(cmd.acctNo());
        order.setAmount(redeemShares); // 1 份 = 1 元，本金（分）= 份额（分刻度）
        order.setShares(shares);
        order.setIncomeAmount(0L);
        order.setStatus(WealthOrder.ST_REDEEMING);
        order.setConfirmDate(LocalDate.now().plusDays(1)); // T+1 清算
        order.setChannel(orDefault(cmd.channel(), "EBANK"));
        order.setOperator(resolveOperator(cmd.operator()));
        try {
            orderMapper.insert(order);
        } catch (DuplicateKeyException e) {
            return toVo(byRequestNo(cmd.requestNo()));
        }

        // 当日锁份额（frozen_shares 扣减）
        positionMapper.update(null, new LambdaUpdateWrapper<Position>()
                .eq(Position::getId, pos.getId())
                .setSql("frozen_shares = frozen_shares + " + shares.toPlainString()));
        log.info("[order] redeem {} accepted, shares={}, confirmDate={}",
                order.getOrderNo(), shares.toPlainString(), order.getConfirmDate());
        return toVo(order);
    }

    public OrderVO byOrderNo(String orderNo) {
        WealthOrder o = orderMapper.selectOne(new LambdaQueryWrapper<WealthOrder>()
                .eq(WealthOrder::getOrderNo, orderNo));
        if (o == null) {
            throw BizException.of(ErrorCodes.NOT_FOUND, "订单不存在: " + orderNo);
        }
        return toVo(o);
    }

    /** 分页查询（渠道按客户查订单） */
    public com.airbank.common.api.PageResult<OrderVO> page(Long customerId, String status, int pageNum, int pageSize) {
        LambdaQueryWrapper<WealthOrder> qw = new LambdaQueryWrapper<WealthOrder>()
                .orderByDesc(WealthOrder::getId);
        if (customerId != null) {
            qw.eq(WealthOrder::getCustomerId, customerId);
        }
        if (status != null && !status.isBlank()) {
            qw.eq(WealthOrder::getStatus, status);
        }
        var page = orderMapper.selectPage(new com.baomidou.mybatisplus.extension.plugins.pagination.Page<>(pageNum, pageSize), qw);
        List<OrderVO> list = toVoList(page.getRecords());
        return new com.airbank.common.api.PageResult<>(list, page.getTotal(), pageNum, pageSize);
    }

    /** 订单查询：按客户/产品/状态/订单号（可组合） */
    public List<OrderVO> list(Long customerId, String productCode, String status, String orderNo) {
        LambdaQueryWrapper<WealthOrder> qw = new LambdaQueryWrapper<WealthOrder>()
                .orderByDesc(WealthOrder::getId).last("LIMIT 200");
        if (orderNo != null && !orderNo.isBlank()) {
            qw.eq(WealthOrder::getOrderNo, orderNo.trim());
        }
        if (customerId != null) {
            qw.eq(WealthOrder::getCustomerId, customerId);
        }
        if (productCode != null && !productCode.isBlank()) {
            qw.eq(WealthOrder::getProductCode, productCode);
        }
        if (status != null && !status.isBlank()) {
            qw.eq(WealthOrder::getStatus, status);
        }
        return toVoList(orderMapper.selectList(qw));
    }

    // ---------- 内部 ----------

    private void requireCmd(String requestNo, Long customerId, String acctNo, String productCode) {
        if (requestNo == null || requestNo.isBlank()) {
            throw BizException.of(ErrorCodes.PARAM_INVALID, "requestNo 不能为空");
        }
        if (customerId == null) {
            throw BizException.of(ErrorCodes.PARAM_INVALID, "customerId 不能为空");
        }
        if (acctNo == null || acctNo.isBlank()) {
            throw BizException.of(ErrorCodes.PARAM_INVALID, "acctNo 不能为空");
        }
        if (productCode == null || productCode.isBlank()) {
            throw BizException.of(ErrorCodes.PARAM_INVALID, "productCode 不能为空");
        }
    }

    /** 风险匹配：产品 Rn 要求客户测评 Cx 数值 x ≥ n（UAM 有效测评，缺失/过期由 UAM 抛 2008） */
    private void checkRisk(Product p, Long customerId) {
        Result<String> r = uamClient.getRiskLevel(customerId);
        String level = r == null ? null : r.getData();
        int own = levelOf(level);
        int need = levelOf(p.getRiskLevel());
        if (own < need) {
            throw BizException.of(ErrorCodes.RISK_MISMATCH,
                    "客户风险等级 " + (level == null ? "未知" : level) + " 低于产品风险等级 "
                            + p.getRiskLevel() + "，不可申购该产品");
        }
    }

    private void checkAmount(Product p, long amount) {
        if (amount <= 0) {
            throw BizException.of(ErrorCodes.PARAM_INVALID, "申购金额必须大于 0");
        }
        if (amount < p.getMinAmount() || (amount - p.getMinAmount()) % p.getStepAmount() != 0) {
            throw BizException.of(ErrorCodes.AMOUNT_BELOW_MIN,
                    "申购金额须不低于起购 ¥" + Money.fenToYuan(p.getMinAmount())
                            + "，并按 ¥" + Money.fenToYuan(p.getStepAmount()) + " 递增");
        }
        if (amount > p.getMaxSingleAmount()) {
            throw BizException.of(ErrorCodes.AMOUNT_OVER_SINGLE,
                    "超过单笔上限 ¥" + Money.fenToYuan(p.getMaxSingleAmount()));
        }
    }

    private void checkRaiseLimit(Product p, long amount) {
        Product fresh = productMapper.selectById(p.getId());
        if (fresh == null) {
            throw BizException.of(ErrorCodes.PRODUCT_NOT_FOUND, "产品不存在");
        }
        if (fresh.getRaiseLimit() - fresh.getRaisedAmount() < amount) {
            throw BizException.of(ErrorCodes.RAISE_LIMIT_NOT_ENOUGH,
                    "募集额度不足（售罄）：剩余 ¥" + Money.fenToYuan(Math.max(fresh.getRaiseLimit() - fresh.getRaisedAmount(), 0)));
        }
    }

    /** 募集额原子累加 + 售罄自动置 SOLD_OUT */
    private void addRaisedAmount(Product p, long amount) {
        productMapper.update(null, new LambdaUpdateWrapper<Product>()
                .eq(Product::getId, p.getId())
                .setSql("raised_amount = raised_amount + " + amount));
        Product fresh = productMapper.selectById(p.getId());
        if (fresh != null && fresh.getRaisedAmount() >= fresh.getRaiseLimit()
                && Product.ST_ON_SALE.equals(fresh.getStatus())) {
            fresh.setStatus(Product.ST_SOLD_OUT);
            productMapper.updateById(fresh);
            log.info("[product] {} sold out (raised {})", fresh.getProductCode(), fresh.getRaisedAmount());
        }
    }

    private TxnVO postTxn(String batchDate, TxnCmd cmd, String nullTxnMsg) {
        Result<TxnVO> r = coreClient.postTxn(batchDate, cmd);
        TxnVO txn = r == null ? null : r.getData();
        if (txn == null || txn.txnNo() == null) {
            throw BizException.of(ErrorCodes.PAY_FAILED, nullTxnMsg);
        }
        return txn;
    }

    private String nextOrderNo() {
        long seq = seqMapper.nextval("seq_order") % 10_000_000_000L;
        return "WO" + LocalDate.now().format(DAY) + String.format("%010d", seq);
    }

    /** 风险等级取数字位：R1/C3 → 1/3 */
    private int levelOf(String s) {
        if (s == null) {
            return 0;
        }
        for (char c : s.trim().toCharArray()) {
            if (c >= '1' && c <= '9') {
                return c - '0';
            }
        }
        return 0;
    }

    private WealthOrder byRequestNo(String requestNo) {
        return orderMapper.selectOne(new LambdaQueryWrapper<WealthOrder>()
                .eq(WealthOrder::getRequestNo, requestNo));
    }

    private String resolveOperator(String cmdOperator) {
        if (cmdOperator != null && !cmdOperator.isBlank()) {
            return cmdOperator;
        }
        AuthUser u = AuthContext.get();
        return u == null ? "system" : u.loginName();
    }

    private String orDefault(String v, String dft) {
        return v == null || v.isBlank() ? dft : v;
    }

    private String truncate(String s) {
        if (s == null) {
            return null;
        }
        return s.length() <= FAIL_REASON_MAX ? s : s.substring(0, FAIL_REASON_MAX);
    }

    private List<OrderVO> toVoList(List<WealthOrder> orders) {
        Map<String, Product> products = productMapper.selectList(null).stream()
                .collect(Collectors.toMap(Product::getProductCode, Function.identity(), (a, b) -> a));
        return orders.stream().map(o -> toVo(o, products.get(o.getProductCode()))).toList();
    }

    public OrderVO toVo(WealthOrder o) {
        Product p = productMapper.selectOne(new LambdaQueryWrapper<Product>()
                .eq(Product::getProductCode, o.getProductCode()));
        return toVo(o, p);
    }

    private OrderVO toVo(WealthOrder o, Product p) {
        return new OrderVO(o.getOrderNo(), o.getOrderType(), o.getProductCode(),
                p == null ? null : p.getProductName(),
                o.getCustomerId(), o.getAcctNo(), o.getAmount(),
                o.getShares() == null ? null : o.getShares().toPlainString(),
                o.getIncomeAmount(), o.getStatus(),
                o.getConfirmDate() == null ? null : o.getConfirmDate().toString(),
                o.getChannel(), o.getOperator(), o.getFailReason(),
                o.getCreatedAt() == null ? null : o.getCreatedAt().toString());
    }
}
