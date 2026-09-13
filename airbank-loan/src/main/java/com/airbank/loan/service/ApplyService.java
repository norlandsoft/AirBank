package com.airbank.loan.service;

import com.airbank.api.core.CoreClient;
import com.airbank.api.core.dto.TxnCmd;
import com.airbank.api.core.dto.TxnVO;
import com.airbank.api.loan.dto.LoanApplicationVO;
import com.airbank.api.loan.dto.LoanApplyCmd;
import com.airbank.api.uam.UamClient;
import com.airbank.api.uam.dto.CustomerDTO;
import com.airbank.common.api.Result;
import com.airbank.common.exception.BizException;
import com.airbank.common.exception.ErrorCodes;
import com.airbank.common.security.AuthContext;
import com.airbank.common.security.AuthUser;
import com.airbank.common.util.Money;
import com.airbank.loan.entity.LoanAccount;
import com.airbank.loan.entity.LoanApply;
import com.airbank.loan.entity.LoanProduct;
import com.airbank.loan.integration.CreditReportClient;
import com.airbank.loan.integration.IdentityCheckClient;
import com.airbank.loan.mapper.LoanApplyMapper;
import com.airbank.loan.mapper.SeqMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Arrays;
import java.util.List;

/**
 * 贷款申请编排（docs/design/13 §4）：
 * 受理（幂等 request_no）→ 联网核查（mock）→ 征信查询（mock）→ 自动审批 → 放款（核心 LOAN_DISBURSE）。
 * 一致性边界：核心放款明确拒绝（BizException）→ 申请 DISBURSE_FAILED 并原样上抛；
 * 其他异常（超时等）→ 申请保持 APPROVED，可按 request_no 重试/人工补放款。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ApplyService {

    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final int REASON_MAX = 256;

    private final LoanApplyMapper applyMapper;
    private final LoanProductService productService;
    private final LoanLedgerService ledgerService;
    private final IdentityCheckClient identityCheck;
    private final CreditReportClient creditReport;
    private final CoreClient coreClient;
    private final UamClient uamClient;
    private final SeqMapper seqMapper;

    /** 申请：校验 → 落单 SUBMITTED → 核查/征信/审批 →（通过）放款入账 */
    public LoanApplicationVO apply(LoanApplyCmd cmd) {
        requireCmd(cmd);
        LoanApply exist = byRequestNo(cmd.requestNo());
        if (exist != null) {
            return toVo(exist); // 幂等：重复请求返回原申请
        }
        LoanProduct p = productService.requireOnSale(cmd.productCode());
        checkAmount(p, cmd.amount());
        checkTerm(p, cmd.termMonths());

        LoanApply app = new LoanApply();
        app.setApplyNo(nextNo("LA", "seq_apply"));
        app.setRequestNo(cmd.requestNo());
        app.setCustomerId(cmd.customerId());
        app.setProductCode(p.getProductCode());
        app.setAmount(cmd.amount());
        app.setTermMonths(cmd.termMonths());
        app.setPurpose(cmd.purpose());
        app.setAcctNo(cmd.acctNo());
        app.setStatus(LoanApply.ST_SUBMITTED);
        app.setChannel(orDefault(cmd.channel(), "EBANK"));
        app.setOperator(resolveOperator(cmd.operator()));
        try {
            applyMapper.insert(app);
        } catch (DuplicateKeyException e) {
            return toVo(byRequestNo(cmd.requestNo())); // request_no 唯一索引兜底
        }

        CustomerDTO customer = customer(cmd.customerId());

        // ① 联网核查（mock 外联，留痕 t_ext_check_log）
        IdentityCheckClient.IdCheckResult idr = identityCheck.verify(
                new IdentityCheckClient.IdCheckRequest(app.getApplyNo(),
                        customer == null ? null : customer.customerName(),
                        customer == null ? null : customer.idNoMask()));
        app.setIdCheckResult(idr.result());
        if (!idr.pass()) {
            return reject(app, "联网核查不通过：" + idr.detail());
        }
        app.setStatus(LoanApply.ST_ID_CHECKED);
        applyMapper.updateById(app);

        // ② 征信查询（mock 外联）
        CreditReportClient.CreditReport cr = creditReport.query(
                new CreditReportClient.CreditQueryRequest(app.getApplyNo(),
                        customer == null ? null : customer.customerNo(),
                        customer == null ? null : customer.customerName(),
                        customer == null ? null : customer.idNoMask()));
        app.setCreditScore(cr.score());
        app.setStatus(LoanApply.ST_CREDIT_CHECKED);
        applyMapper.updateById(app);

        // ③ 自动审批
        Decision dec = decide(p, cmd.amount(), cr);
        if (!dec.approved()) {
            app.setCreditScore(cr.hit() ? cr.score() : null);
            return reject(app, dec.reason());
        }
        app.setApproveAmount(dec.amount());
        app.setApproveRate(dec.rate());
        app.setStatus(LoanApply.ST_APPROVED);
        applyMapper.updateById(app);

        // ④ 放款（核心统一记账，幂等键 = 申请 requestNo）
        try {
            TxnVO txn = postTxn(new TxnCmd(cmd.requestNo(), "LOAN_DISBURSE", null, cmd.acctNo(),
                    dec.amount(), "贷款放款 " + p.getProductCode() + " " + app.getApplyNo(),
                    app.getChannel(), app.getOperator(), null));
            LoanAccount loan = ledgerService.openLoan(app, p, dec.amount(), dec.rate(),
                    txn.txnNo(), nextNo("LN", "seq_loan"));
            app.setLoanNo(loan.getLoanNo());
            app.setStatus(LoanApply.ST_DISBURSED);
            applyMapper.updateById(app);
            log.info("[apply] {} approved & disbursed: loan={}, amount={}, rate={}",
                    app.getApplyNo(), loan.getLoanNo(), dec.amount(), dec.rate());
        } catch (BizException e) {
            app.setStatus(LoanApply.ST_DISBURSE_FAILED);
            app.setRejectReason(truncate("放款失败：" + e.getMessage()));
            applyMapper.updateById(app);
            throw BizException.of(ErrorCodes.LOAN_DISBURSE_FAILED, app.getRejectReason());
        }
        return toVo(app);
    }

    public LoanApplicationVO byApplyNo(String applyNo) {
        LoanApply app = applyMapper.selectOne(new LambdaQueryWrapper<LoanApply>()
                .eq(LoanApply::getApplyNo, applyNo));
        if (app == null) {
            throw BizException.of(ErrorCodes.NOT_FOUND, "申请不存在: " + applyNo);
        }
        return toVo(app);
    }

    public List<LoanApplicationVO> listByCustomer(Long customerId) {
        return applyMapper.selectList(new LambdaQueryWrapper<LoanApply>()
                        .eq(LoanApply::getCustomerId, customerId)
                        .orderByDesc(LoanApply::getId).last("LIMIT 100"))
                .stream().map(this::toVo).toList();
    }

    // ---------- 审批 ----------

    private record Decision(boolean approved, long amount, BigDecimal rate, String reason) { }

    /** 自动审批规则（docs/design/13 §4.3）：征信准入 → 额度核定 → 风险加点定价 */
    private Decision decide(LoanProduct p, long applyAmount, CreditReportClient.CreditReport cr) {
        if (!cr.hit()) {
            return new Decision(false, 0, null, "未查询到征信记录（白户），暂无法授信");
        }
        if (cr.currentOverdue()) {
            return new Decision(false, 0, null, "征信报告显示存在当前逾期，审批拒绝");
        }
        if (cr.overdueCount() >= 3) {
            return new Decision(false, 0, null, "历史逾期次数过多（" + cr.overdueCount() + " 次），审批拒绝");
        }
        if (cr.queryCount6M() > 6) {
            return new Decision(false, 0, null, "近 6 个月征信查询次数过多（" + cr.queryCount6M() + " 次），审批拒绝");
        }
        if (cr.score() < p.getMinScore()) {
            return new Decision(false, 0, null,
                    "征信评分 " + cr.score() + " 低于产品准入线 " + p.getMinScore() + "，审批拒绝");
        }
        // 额度核定：按征信分分段给上限（分）
        long scoreLimit = cr.score() < 600 ? 5_000_000L
                : cr.score() < 700 ? 10_000_000L
                : cr.score() < 800 ? 20_000_000L
                : Long.MAX_VALUE;
        long approve = Math.min(Math.min(applyAmount, p.getMaxAmount()), scoreLimit);
        if (approve < p.getMinAmount()) {
            return new Decision(false, 0, null,
                    "核定额度低于起借金额 ¥" + Money.fenToYuan(p.getMinAmount()) + "，审批拒绝");
        }
        // 风险加点：征信分越低利率越高
        BigDecimal rate = p.getAnnualRate().add(
                cr.score() < 650 ? new BigDecimal("0.0200")
                        : cr.score() < 750 ? new BigDecimal("0.0100")
                        : BigDecimal.ZERO);
        return new Decision(true, approve, rate, null);
    }

    // ---------- 放款（台账落库见 LoanLedgerService） ----------

    // ---------- 内部 ----------

    private void requireCmd(LoanApplyCmd cmd) {
        if (cmd.requestNo() == null || cmd.requestNo().isBlank()) {
            throw BizException.of(ErrorCodes.PARAM_INVALID, "requestNo 不能为空");
        }
        if (cmd.customerId() == null) {
            throw BizException.of(ErrorCodes.PARAM_INVALID, "customerId 不能为空");
        }
        if (cmd.productCode() == null || cmd.productCode().isBlank()) {
            throw BizException.of(ErrorCodes.PARAM_INVALID, "productCode 不能为空");
        }
        if (cmd.acctNo() == null || cmd.acctNo().isBlank()) {
            throw BizException.of(ErrorCodes.PARAM_INVALID, "acctNo 不能为空");
        }
        if (cmd.termMonths() == null) {
            throw BizException.of(ErrorCodes.LOAN_TERM_INVALID, "借款期限不能为空");
        }
    }

    private void checkAmount(LoanProduct p, long amount) {
        if (amount < p.getMinAmount() || amount > p.getMaxAmount()) {
            throw BizException.of(ErrorCodes.LOAN_AMOUNT_INVALID,
                    "借款金额须在 ¥" + Money.fenToYuan(p.getMinAmount())
                            + " ~ ¥" + Money.fenToYuan(p.getMaxAmount()) + " 之间");
        }
    }

    private void checkTerm(LoanProduct p, int termMonths) {
        boolean ok = Arrays.stream(p.getTermOptions().split(","))
                .map(String::trim).anyMatch(t -> t.equals(String.valueOf(termMonths)));
        if (!ok) {
            throw BizException.of(ErrorCodes.LOAN_TERM_INVALID,
                    "借款期限须为 " + p.getTermOptions() + " 个月之一");
        }
    }

    private CustomerDTO customer(Long customerId) {
        Result<CustomerDTO> r = uamClient.getCustomer(customerId);
        return r == null ? null : r.getData();
    }

    private LoanApplicationVO reject(LoanApply app, String reason) {
        app.setStatus(LoanApply.ST_REJECTED);
        app.setRejectReason(truncate(reason));
        applyMapper.updateById(app);
        log.info("[apply] {} rejected: {}", app.getApplyNo(), reason);
        return toVo(app);
    }

    private TxnVO postTxn(TxnCmd cmd) {
        Result<TxnVO> r = coreClient.postTxn(null, cmd);
        TxnVO txn = r == null ? null : r.getData();
        if (txn == null || txn.txnNo() == null) {
            throw BizException.of(ErrorCodes.LOAN_DISBURSE_FAILED, "核心记账未返回流水号");
        }
        return txn;
    }

    String nextNo(String prefix, String seq) {
        long v = seqMapper.nextval(seq) % 10_000_000_000L;
        return prefix + LocalDate.now().format(DAY) + String.format("%010d", v);
    }

    private LoanApply byRequestNo(String requestNo) {
        return applyMapper.selectOne(new LambdaQueryWrapper<LoanApply>()
                .eq(LoanApply::getRequestNo, requestNo));
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
        return s.length() <= REASON_MAX ? s : s.substring(0, REASON_MAX);
    }

    LoanApplicationVO toVo(LoanApply a) {
        String productName = productService.require(a.getProductCode()).getProductName();
        return new LoanApplicationVO(a.getApplyNo(), a.getRequestNo(), a.getCustomerId(),
                a.getProductCode(), productName, a.getAmount(), a.getTermMonths(), a.getPurpose(),
                a.getAcctNo(), a.getStatus(), a.getIdCheckResult(), a.getCreditScore(),
                a.getApproveAmount(), a.getApproveRate(), a.getRejectReason(), a.getLoanNo(),
                a.getChannel(), a.getOperator(),
                a.getCreatedAt() == null ? null : a.getCreatedAt().toString());
    }
}
