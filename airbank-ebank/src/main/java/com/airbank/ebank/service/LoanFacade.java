package com.airbank.ebank.service;

import com.airbank.api.core.CoreClient;
import com.airbank.api.core.dto.AccountVO;
import com.airbank.api.loan.LoanClient;
import com.airbank.api.loan.dto.LoanAccountVO;
import com.airbank.api.loan.dto.LoanApplicationVO;
import com.airbank.api.loan.dto.LoanApplyCmd;
import com.airbank.api.loan.dto.LoanDetailVO;
import com.airbank.api.loan.dto.LoanProductVO;
import com.airbank.api.loan.dto.LoanRepayCmd;
import com.airbank.api.loan.dto.LoanRepaymentVO;
import com.airbank.common.exception.BizException;
import com.airbank.common.exception.ErrorCodes;
import com.airbank.common.util.Money;
import com.airbank.ebank.entity.Message;
import com.airbank.ebank.model.LoanApplyReq;
import com.airbank.ebank.model.LoanRepayReq;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 小额信贷渠道编排（docs/design/13 §7）：OTP 申请/还款（走本人活期账户）、回单与消息通知。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LoanFacade {

    public static final String SCENE_LOAN = "LOAN";
    private static final String CHANNEL = "EBANK";

    private final LoanClient loanClient;
    private final CoreClient coreClient;
    private final OtpService otpService;
    private final ReceiptService receiptService;
    private final MessageService messageService;

    /** GET /loan/products：在售贷款产品 */
    public List<LoanProductVO> products() {
        List<LoanProductVO> products = OwnerGuard.data(loanClient.listProducts("ON_SALE"));
        return products == null ? List.of() : products;
    }

    /**
     * POST /loan/apply：OTP(scene=LOAN) → 本人活期账户 → 信贷系统申请
     * （联网核查/征信/审批/放款由信贷系统同步完成；REJECTED 为正常业务结论，不抛异常）。
     */
    public LoanApplicationVO apply(Long customerId, LoanApplyReq req) {
        otpService.verifyOrThrow(customerId, SCENE_LOAN, req.otpCode());
        long amount = Money.yuanToFen(req.amount() == null ? null : req.amount().toPlainString());
        if (amount <= 0) {
            throw BizException.of(ErrorCodes.PARAM_INVALID, "借款金额必须大于 0");
        }
        String acctNo = demandAcctNo(customerId);
        LoanApplicationVO app;
        try {
            app = OwnerGuard.data(loanClient.apply(new LoanApplyCmd(
                    req.requestNo(), customerId, req.productCode(), amount, req.termMonths(),
                    req.purpose(), acctNo, CHANNEL, OwnerGuard.loginName())));
        } catch (BizException e) {
            messageService.notify(customerId, Message.TYPE_SYS, "贷款申请失败",
                    "产品 " + req.productCode() + " 借款 ¥" + Money.fenToYuan(amount)
                            + " 申请失败：" + e.getMessage());
            throw e;
        }
        if (app == null) {
            throw BizException.of(ErrorCodes.DOWNSTREAM_UNAVAILABLE, "信贷系统无响应");
        }
        if ("DISBURSED".equals(app.status())) {
            receipt(customerId, "LOAN_DISBURSE", app.loanNo(), app.applyNo(), app.productName(),
                    app.approveAmount(), "放款成功，资金已入活期账户 " + app.acctNo());
            messageService.notify(customerId, Message.TYPE_SYS, "贷款放款成功",
                    "您申请的 " + app.productName() + " 已放款 ¥" + Money.fenToYuan(app.approveAmount())
                            + " 至活期账户，借据号 " + app.loanNo() + "，按月等额本息还款。");
        } else if ("REJECTED".equals(app.status())) {
            messageService.notify(customerId, Message.TYPE_SYS, "贷款申请未通过",
                    "您申请的 " + app.productName() + " 未获批准：" + app.rejectReason());
        }
        return app;
    }

    /** GET /loan/applications：本人申请记录 */
    public List<LoanApplicationVO> applications(Long customerId) {
        List<LoanApplicationVO> list = OwnerGuard.data(loanClient.applications(customerId));
        return list == null ? List.of() : list;
    }

    /** GET /loan/loans：本人借据 */
    public List<LoanAccountVO> loans(Long customerId) {
        List<LoanAccountVO> list = OwnerGuard.data(loanClient.loans(customerId));
        return list == null ? List.of() : list;
    }

    /** GET /loan/loans/{loanNo}：借据详情（限本人） */
    public LoanDetailVO loanDetail(Long customerId, String loanNo) {
        LoanDetailVO detail = OwnerGuard.data(loanClient.loanDetail(loanNo));
        if (detail == null || detail.account() == null || !customerId.equals(detail.account().customerId())) {
            throw BizException.of(ErrorCodes.NOT_OWNER, "仅借款人本人可查看借据详情");
        }
        return detail;
    }

    /** POST /loan/repay：OTP(scene=LOAN) → 本人活期账户扣款还本付息 */
    public LoanRepaymentVO repay(Long customerId, LoanRepayReq req) {
        otpService.verifyOrThrow(customerId, SCENE_LOAN, req.otpCode());
        String acctNo = demandAcctNo(customerId);
        LoanRepaymentVO rp;
        try {
            rp = OwnerGuard.data(loanClient.repay(new LoanRepayCmd(
                    req.requestNo(), req.loanNo(), customerId, acctNo, req.repayMode(),
                    CHANNEL, OwnerGuard.loginName())));
        } catch (BizException e) {
            messageService.notify(customerId, Message.TYPE_SYS, "贷款还款失败",
                    "借据 " + req.loanNo() + " 还款失败：" + e.getMessage());
            throw e;
        }
        if (rp == null) {
            throw BizException.of(ErrorCodes.DOWNSTREAM_UNAVAILABLE, "信贷系统无响应");
        }
        String modeLabel = "SETTLE".equals(rp.repayMode()) ? "提前结清" : "第 " + rp.periodNo() + " 期还款";
        receipt(customerId, "LOAN_REPAY", rp.repayNo(), rp.loanNo(), modeLabel,
                rp.amount(), "其中本金 ¥" + Money.fenToYuan(rp.principalPart())
                        + "、利息 ¥" + Money.fenToYuan(rp.interestPart()));
        messageService.notify(customerId, Message.TYPE_SYS, "贷款还款成功",
                "借据 " + rp.loanNo() + " " + modeLabel + " ¥" + Money.fenToYuan(rp.amount())
                        + "（本金 ¥" + Money.fenToYuan(rp.principalPart())
                        + " + 利息 ¥" + Money.fenToYuan(rp.interestPart()) + "）。");
        return rp;
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

    private void receipt(Long customerId, String bizType, String bizNo, String refNo,
                         String title, long amount, String note) {
        Map<String, Object> content = new LinkedHashMap<>();
        content.put("issuer", "AirBank 网上银行");
        content.put("bizType", bizType);
        content.put("bizNo", bizNo);
        content.put("refNo", refNo);
        content.put("customerId", customerId);
        content.put("title", title);
        content.put("amountFen", amount);
        content.put("amountYuan", Money.fenToYuan(amount));
        content.put("note", note);
        content.put("channel", CHANNEL);
        receiptService.create(customerId, bizType, bizNo, content);
    }
}
