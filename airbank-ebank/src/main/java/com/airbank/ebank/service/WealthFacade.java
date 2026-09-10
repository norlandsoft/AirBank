package com.airbank.ebank.service;

import com.airbank.api.core.CoreClient;
import com.airbank.api.core.dto.AccountVO;
import com.airbank.api.uam.UamClient;
import com.airbank.api.wealth.WealthClient;
import com.airbank.api.wealth.dto.OrderVO;
import com.airbank.api.wealth.dto.PositionVO;
import com.airbank.api.wealth.dto.RedeemCmd;
import com.airbank.api.wealth.dto.SubscribeCmd;
import com.airbank.api.wealth.dto.ProductVO;
import com.airbank.common.api.PageResult;
import com.airbank.common.exception.BizException;
import com.airbank.common.exception.ErrorCodes;
import com.airbank.common.util.Money;
import com.airbank.ebank.entity.Message;
import com.airbank.ebank.integration.WealthExtraClient;
import com.airbank.ebank.model.ProductCardVO;
import com.airbank.ebank.model.RedeemReq;
import com.airbank.ebank.model.SubscribeReq;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 理财超市渠道编排（docs/design/05 §3.3）：产品风险匹配标注、OTP 申赎（走本人活期账户）、持仓与订单查询。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WealthFacade {

    public static final String SCENE_WEALTH = "WEALTH";
    private static final String CHANNEL = "EBANK";

    private final WealthClient wealthClient;
    private final WealthExtraClient wealthExtra;
    private final CoreClient coreClient;
    private final UamClient uamClient;
    private final OtpService otpService;
    private final ReceiptService receiptService;
    private final MessageService messageService;

    /** GET /wealth/products：全量在售产品 + canBuy（客户风险等级数值 ≥ 产品风险等级数值）+ myRiskLevel */
    public List<ProductCardVO> products(Long customerId) {
        List<ProductVO> products = OwnerGuard.data(wealthClient.listProducts(null));
        List<ProductVO> safe = products == null ? List.of() : products;
        String myLevel = riskLevelOrNull(customerId);
        Integer myNum = myLevel == null ? null : levelNum(myLevel);
        return safe.stream()
                .map(p -> new ProductCardVO(p, myNum != null && myNum >= levelNum(p.riskLevel()), myLevel))
                .toList();
    }

    /** POST /wealth/subscribe：OTP(scene=WEALTH) → 本人活期账户 → 理财下单（下单即扣款） */
    public OrderVO subscribe(Long customerId, SubscribeReq req) {
        otpService.verifyOrThrow(customerId, SCENE_WEALTH, req.otpCode());
        long amount = Money.yuanToFen(req.amount() == null ? null : req.amount().toPlainString());
        if (amount <= 0) {
            throw BizException.of(ErrorCodes.PARAM_INVALID, "申购金额必须大于 0");
        }
        String acctNo = demandAcctNo(customerId);
        OrderVO order;
        try {
            order = OwnerGuard.data(wealthClient.subscribe(new SubscribeCmd(
                    req.requestNo(), customerId, acctNo, req.productCode(), amount, CHANNEL,
                    OwnerGuard.loginName())));
        } catch (BizException e) {
            messageService.notify(customerId, Message.TYPE_SYS, "理财申购失败",
                    "产品 " + req.productCode() + " 申购 ¥" + Money.fenToYuan(amount) + " 失败：" + e.getMessage());
            throw e;
        }
        afterTrade(customerId, "WEALTH_SUBSCRIBE", order, "申购",
                amount, order == null ? null : order.orderNo());
        return order;
    }

    /** POST /wealth/redeem：OTP(scene=WEALTH) → 本人活期账户 → 理财赎回（本金+收益入活期） */
    public OrderVO redeem(Long customerId, RedeemReq req) {
        otpService.verifyOrThrow(customerId, SCENE_WEALTH, req.otpCode());
        if (req.shares() == null || req.shares() <= 0) {
            throw BizException.of(ErrorCodes.PARAM_INVALID, "赎回份额必须大于 0");
        }
        String acctNo = demandAcctNo(customerId);
        OrderVO order;
        try {
            order = OwnerGuard.data(wealthClient.redeem(new RedeemCmd(
                    req.requestNo(), customerId, acctNo, req.productCode(), req.shares(), CHANNEL,
                    OwnerGuard.loginName())));
        } catch (BizException e) {
            messageService.notify(customerId, Message.TYPE_SYS, "理财赎回失败",
                    "产品 " + req.productCode() + " 赎回 " + req.shares() + " 份失败：" + e.getMessage());
            throw e;
        }
        long amount = order == null || order.amount() <= 0 ? 0 : order.amount();
        afterTrade(customerId, "WEALTH_REDEEM", order, "赎回", amount,
                order == null ? null : order.orderNo());
        return order;
    }

    /** GET /wealth/positions：本人持仓 */
    public List<PositionVO> positions(Long customerId) {
        List<PositionVO> positions = OwnerGuard.data(wealthClient.positions(customerId));
        return positions == null ? List.of() : positions;
    }

    /**
     * GET /wealth/orders：本人申赎订单分页。
     * 联调缺口：依赖 wealth 服务 GET /orders?customerId=（airbank-api-wealth 暂无该契约方法）；
     * 若 wealth 未实现该端点（404/不可达），降级返回空页，避免影响"交易记录"页面展示。
     */
    public PageResult<OrderVO> orders(Long customerId, int pageNum, int pageSize) {
        try {
            return OwnerGuard.data(wealthExtra.orders(customerId, pageNum, pageSize));
        } catch (BizException e) {
            if (e.getCode() == ErrorCodes.NOT_FOUND || e.getCode() == ErrorCodes.DOWNSTREAM_UNAVAILABLE) {
                log.warn("wealth GET /orders 未实现或不可用，返回空页（联调点）: {}", e.getMessage());
                return new PageResult<>(List.of(), 0, pageNum, pageSize);
            }
            throw e;
        }
    }

    // ---------- 内部 ----------

    /** 本人第一个 DEMAND + ACTIVE 账户；无可用账户 → 3001 */
    private String demandAcctNo(Long customerId) {
        List<AccountVO> accounts = OwnerGuard.data(coreClient.listAccounts(customerId));
        return accounts.stream()
                .filter(a -> "DEMAND".equals(a.acctType()) && "ACTIVE".equals(a.status()))
                .map(AccountVO::acctNo)
                .findFirst()
                .orElseThrow(() -> BizException.of(ErrorCodes.ACCT_NOT_FOUND, "无可用活期账户，请先开立或恢复账户"));
    }

    /** 风险等级缺失/过期（2008）时返回 null：产品仅展示，canBuy=false */
    private String riskLevelOrNull(Long customerId) {
        try {
            return OwnerGuard.data(uamClient.getRiskLevel(customerId));
        } catch (BizException e) {
            if (e.getCode() == ErrorCodes.RISK_ASSESS_MISSING) {
                return null;
            }
            throw e;
        }
    }

    private void afterTrade(Long customerId, String bizType, OrderVO order, String actionLabel,
                            long amount, String orderNo) {
        Map<String, Object> content = new LinkedHashMap<>();
        content.put("issuer", "AirBank 网上银行");
        content.put("bizType", bizType);
        content.put("bizNo", orderNo);
        content.put("customerId", customerId);
        content.put("productCode", order == null ? null : order.productCode());
        content.put("productName", order == null ? null : order.productName());
        content.put("amountFen", amount);
        content.put("amountYuan", Money.fenToYuan(amount));
        content.put("shares", order == null ? null : order.shares());
        content.put("acctNo", order == null ? null : order.acctNo());
        content.put("status", order == null ? null : order.status());
        content.put("channel", CHANNEL);
        content.put("result", actionLabel + "成功");
        String receiptNo = receiptService.create(customerId, bizType, orderNo, content);
        messageService.notify(customerId, Message.TYPE_SYS, "理财" + actionLabel + "成功",
                "产品 " + (order == null ? "" : order.productName()) + " " + actionLabel
                        + " ¥" + Money.fenToYuan(amount) + " 已受理，回单号 " + receiptNo + "。");
    }

    /** "C1"~"C5" → 1~5；无法解析按最高风险处理 */
    private static int levelNum(String level) {
        if (level != null) {
            String digits = level.replaceAll("\\D", "");
            if (!digits.isEmpty()) {
                try {
                    return Integer.parseInt(digits);
                } catch (NumberFormatException ignore) {
                    // fall through
                }
            }
        }
        return Integer.MAX_VALUE;
    }
}
