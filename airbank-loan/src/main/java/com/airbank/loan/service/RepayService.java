package com.airbank.loan.service;

import com.airbank.api.core.CoreClient;
import com.airbank.api.core.dto.TxnCmd;
import com.airbank.api.core.dto.TxnVO;
import com.airbank.api.loan.dto.LoanRepayCmd;
import com.airbank.api.loan.dto.LoanRepaymentVO;
import com.airbank.common.api.Result;
import com.airbank.common.exception.BizException;
import com.airbank.common.exception.ErrorCodes;
import com.airbank.common.security.AuthContext;
import com.airbank.common.security.AuthUser;
import com.airbank.loan.entity.LoanAccount;
import com.airbank.loan.entity.LoanRepayment;
import com.airbank.loan.entity.LoanSchedule;
import com.airbank.loan.mapper.LoanAccountMapper;
import com.airbank.loan.mapper.LoanRepaymentMapper;
import com.airbank.loan.mapper.LoanScheduleMapper;
import com.airbank.loan.mapper.SeqMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * 还款服务（docs/design/13 §4.5）。
 * INSTALLMENT：还最早未还一期（计划本金+利息）；SETTLE：提前结清（剩余本金 + 当期利息 = 剩余本金×月利率）。
 * 核心记账拆分两笔：LOAN_REPAY_PRINCIPAL（借 2011 / 贷 1221）+ LOAN_REPAY_INTEREST（借 2011 / 贷 6021），
 * 幂等键 requestNo+":P"/":I"。一致性边界：BizException（余额不足等明确拒绝）→ 还款记录 FAILED 并原样上抛；
 * 其他异常上抛待重试（核心幂等兜底）。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RepayService {

    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final int REASON_MAX = 256;

    private final LoanAccountMapper loanMapper;
    private final LoanScheduleMapper scheduleMapper;
    private final LoanRepaymentMapper repaymentMapper;
    private final CoreClient coreClient;
    private final SeqMapper seqMapper;

    public LoanRepaymentVO repay(LoanRepayCmd cmd) {
        requireCmd(cmd);
        LoanRepayment exist = repaymentMapper.selectOne(new LambdaQueryWrapper<LoanRepayment>()
                .eq(LoanRepayment::getRequestNo, cmd.requestNo()));
        if (exist != null) {
            return toVo(exist); // 幂等
        }
        LoanAccount loan = loanMapper.selectOne(new LambdaQueryWrapper<LoanAccount>()
                .eq(LoanAccount::getLoanNo, cmd.loanNo()));
        if (loan == null) {
            throw BizException.of(ErrorCodes.LOAN_NOT_FOUND, "借据不存在: " + cmd.loanNo());
        }
        if (!LoanAccount.ST_REPAYING.equals(loan.getStatus())) {
            throw BizException.of(ErrorCodes.LOAN_STATUS_DENY,
                    "借据当前状态 " + loan.getStatus() + "，不可还款");
        }
        if (!loan.getCustomerId().equals(cmd.customerId())) {
            throw BizException.of(ErrorCodes.NOT_OWNER, "仅借款人本人可还款");
        }
        if (!loan.getAcctNo().equals(cmd.acctNo())) {
            throw BizException.of(ErrorCodes.PARAM_INVALID, "还款账户须为放款账户 " + loan.getAcctNo());
        }

        // 权威金额计算（渠道不传金额）
        LoanSchedule installment = null;
        long principalPart;
        long interestPart;
        if (LoanRepayment.MODE_SETTLE.equals(cmd.repayMode())) {
            principalPart = loan.getRemainPrincipal();
            interestPart = BigDecimal.valueOf(loan.getRemainPrincipal())
                    .multiply(loan.getAnnualRate().divide(BigDecimal.valueOf(12), 10, RoundingMode.HALF_UP))
                    .setScale(0, RoundingMode.HALF_UP).longValueExact();
        } else if (LoanRepayment.MODE_INSTALLMENT.equals(cmd.repayMode())) {
            installment = scheduleMapper.selectOne(new LambdaQueryWrapper<LoanSchedule>()
                    .eq(LoanSchedule::getLoanId, loan.getId())
                    .eq(LoanSchedule::getStatus, LoanSchedule.ST_PENDING)
                    .orderByAsc(LoanSchedule::getPeriodNo).last("LIMIT 1"));
            if (installment == null) {
                throw BizException.of(ErrorCodes.LOAN_STATUS_DENY, "无待还期次");
            }
            principalPart = installment.getPrincipal();
            interestPart = installment.getInterest();
        } else {
            throw BizException.of(ErrorCodes.REPAY_MODE_INVALID,
                    "repayMode 须为 INSTALLMENT / SETTLE");
        }

        LoanRepayment rp = new LoanRepayment();
        rp.setRepayNo(nextNo());
        rp.setRequestNo(cmd.requestNo());
        rp.setLoanId(loan.getId());
        rp.setLoanNo(loan.getLoanNo());
        rp.setRepayMode(cmd.repayMode());
        rp.setPeriodNo(installment == null ? null : installment.getPeriodNo());
        rp.setAmount(principalPart + interestPart);
        rp.setPrincipalPart(principalPart);
        rp.setInterestPart(interestPart);
        rp.setChannel(orDefault(cmd.channel(), "EBANK"));
        rp.setOperator(resolveOperator(cmd.operator()));
        try {
            repaymentMapper.insert(rp);
        } catch (DuplicateKeyException e) {
            return toVo(repaymentMapper.selectOne(new LambdaQueryWrapper<LoanRepayment>()
                    .eq(LoanRepayment::getRequestNo, cmd.requestNo())));
        }

        try {
            TxnVO pTxn = postTxn(new TxnCmd(cmd.requestNo() + ":P", "LOAN_REPAY_PRINCIPAL",
                    loan.getAcctNo(), null, principalPart,
                    "贷款还本 " + loan.getLoanNo(), rp.getChannel(), rp.getOperator(), null));
            rp.setPrincipalTxnNo(pTxn.txnNo());
            if (interestPart > 0) {
                TxnVO iTxn = postTxn(new TxnCmd(cmd.requestNo() + ":I", "LOAN_REPAY_INTEREST",
                        loan.getAcctNo(), null, interestPart,
                        "贷款付息 " + loan.getLoanNo(), rp.getChannel(), rp.getOperator(), null));
                rp.setInterestTxnNo(iTxn.txnNo());
            }
        } catch (BizException e) {
            rp.setStatus(LoanRepayment.ST_FAILED);
            rp.setFailReason(truncate(e.getMessage()));
            repaymentMapper.updateById(rp);
            throw BizException.of(ErrorCodes.LOAN_REPAY_FAILED, "还款扣款失败：" + e.getMessage());
        }

        // 台账与计划更新
        rp.setStatus(LoanRepayment.ST_SUCCESS);
        repaymentMapper.updateById(rp);
        loan.setRemainPrincipal(loan.getRemainPrincipal() - principalPart);
        loan.setPaidPrincipal(loan.getPaidPrincipal() + principalPart);
        loan.setPaidInterest(loan.getPaidInterest() + interestPart);
        LocalDateTime now = LocalDateTime.now();
        if (LoanRepayment.MODE_SETTLE.equals(cmd.repayMode())) {
            loan.setStatus(LoanAccount.ST_SETTLED);
            markAllPaid(loan.getId(), now);
        } else {
            installment.setStatus(LoanSchedule.ST_PAID);
            installment.setPaidAt(now);
            scheduleMapper.updateById(installment);
            if (loan.getRemainPrincipal() <= 0) {
                loan.setStatus(LoanAccount.ST_SETTLED);
                markAllPaid(loan.getId(), now);
            }
        }
        loanMapper.updateById(loan);
        log.info("[repay] {} {} ok: principal={}, interest={}, remain={}",
                rp.getRepayNo(), cmd.repayMode(), principalPart, interestPart, loan.getRemainPrincipal());
        return toVo(rp);
    }

    public List<LoanRepaymentVO> listByLoan(Long loanId) {
        return repaymentMapper.selectList(new LambdaQueryWrapper<LoanRepayment>()
                        .eq(LoanRepayment::getLoanId, loanId)
                        .orderByAsc(LoanRepayment::getId))
                .stream().map(RepayService::toVo).toList();
    }

    // ---------- 内部 ----------

    private void markAllPaid(Long loanId, LocalDateTime now) {
        List<LoanSchedule> pending = scheduleMapper.selectList(new LambdaQueryWrapper<LoanSchedule>()
                .eq(LoanSchedule::getLoanId, loanId)
                .eq(LoanSchedule::getStatus, LoanSchedule.ST_PENDING));
        for (LoanSchedule s : pending) {
            s.setStatus(LoanSchedule.ST_PAID);
            s.setPaidAt(now);
            scheduleMapper.updateById(s);
        }
    }

    private void requireCmd(LoanRepayCmd cmd) {
        if (cmd.requestNo() == null || cmd.requestNo().isBlank()) {
            throw BizException.of(ErrorCodes.PARAM_INVALID, "requestNo 不能为空");
        }
        if (cmd.loanNo() == null || cmd.loanNo().isBlank()) {
            throw BizException.of(ErrorCodes.PARAM_INVALID, "loanNo 不能为空");
        }
        if (cmd.customerId() == null) {
            throw BizException.of(ErrorCodes.PARAM_INVALID, "customerId 不能为空");
        }
        if (cmd.acctNo() == null || cmd.acctNo().isBlank()) {
            throw BizException.of(ErrorCodes.PARAM_INVALID, "acctNo 不能为空");
        }
    }

    private TxnVO postTxn(TxnCmd cmd) {
        Result<TxnVO> r = coreClient.postTxn(null, cmd);
        TxnVO txn = r == null ? null : r.getData();
        if (txn == null || txn.txnNo() == null) {
            throw BizException.of(ErrorCodes.LOAN_REPAY_FAILED, "核心记账未返回流水号");
        }
        return txn;
    }

    private String nextNo() {
        long v = seqMapper.nextval("seq_repay") % 10_000_000_000L;
        return "RP" + LocalDate.now().format(DAY) + String.format("%010d", v);
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

    static LoanRepaymentVO toVo(LoanRepayment r) {
        return new LoanRepaymentVO(r.getRepayNo(), r.getLoanNo(), r.getRepayMode(), r.getPeriodNo(),
                r.getAmount(), r.getPrincipalPart(), r.getInterestPart(),
                r.getPrincipalTxnNo(), r.getInterestTxnNo(), r.getStatus(), r.getFailReason(),
                r.getCreatedAt() == null ? null : r.getCreatedAt().toString());
    }
}
