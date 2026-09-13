package com.airbank.loan.service;

import com.airbank.loan.entity.LoanAccount;
import com.airbank.loan.entity.LoanApply;
import com.airbank.loan.entity.LoanProduct;
import com.airbank.loan.entity.LoanSchedule;
import com.airbank.loan.mapper.LoanAccountMapper;
import com.airbank.loan.mapper.LoanScheduleMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * 借据台账服务（docs/design/13 §4.4）：核心放款成功后，本地事务内落借据 + 等额本息还款计划。
 */
@Service
@RequiredArgsConstructor
public class LoanLedgerService {

    private final LoanAccountMapper loanMapper;
    private final LoanScheduleMapper scheduleMapper;

    /** 开立借据 + 生成还款计划（本地事务） */
    @Transactional
    public LoanAccount openLoan(LoanApply app, LoanProduct p, long amount, BigDecimal rate,
                                String disburseTxnNo, String loanNo) {
        LocalDate today = LocalDate.now();
        LoanAccount loan = new LoanAccount();
        loan.setLoanNo(loanNo);
        loan.setApplyNo(app.getApplyNo());
        loan.setCustomerId(app.getCustomerId());
        loan.setProductCode(p.getProductCode());
        loan.setProductName(p.getProductName());
        loan.setPrincipal(amount);
        loan.setAnnualRate(rate);
        loan.setTermMonths(app.getTermMonths());
        loan.setRepayMethod(p.getRepayMethod());
        loan.setAcctNo(app.getAcctNo());
        loan.setDisburseTxnNo(disburseTxnNo);
        loan.setDisburseDate(today);
        loan.setRemainPrincipal(amount);
        loan.setPaidPrincipal(0L);
        loan.setPaidInterest(0L);
        loan.setStatus(LoanAccount.ST_REPAYING);
        loan.setChannel(app.getChannel());
        loan.setOperator(app.getOperator());
        loanMapper.insert(loan);

        for (LoanSchedule s : equalInstallment(loan.getId(), loan.getLoanNo(),
                amount, rate, app.getTermMonths(), today)) {
            scheduleMapper.insert(s);
        }
        return loan;
    }

    /**
     * 等额本息计划：月供 = P·r·(1+r)ⁿ / ((1+r)ⁿ−1)，r = 年利率/12；
     * 逐期 利息=剩余本金·r（分位四舍五入），本金=月供−利息，末期本金轧差结清。
     */
    static List<LoanSchedule> equalInstallment(Long loanId, String loanNo, long principalFen,
                                               BigDecimal annualRate, int months, LocalDate start) {
        BigDecimal r = annualRate.divide(BigDecimal.valueOf(12), 10, RoundingMode.HALF_UP);
        BigDecimal p = BigDecimal.valueOf(principalFen);
        long pmt;
        if (r.compareTo(BigDecimal.ZERO) == 0) {
            pmt = p.divide(BigDecimal.valueOf(months), 0, RoundingMode.HALF_UP).longValueExact();
        } else {
            BigDecimal factor = r.add(BigDecimal.ONE).pow(months);
            pmt = p.multiply(r).multiply(factor)
                    .divide(factor.subtract(BigDecimal.ONE), 0, RoundingMode.HALF_UP)
                    .longValueExact();
        }
        List<LoanSchedule> list = new ArrayList<>(months);
        long remaining = principalFen;
        for (int i = 1; i <= months; i++) {
            long interest = BigDecimal.valueOf(remaining).multiply(r)
                    .setScale(0, RoundingMode.HALF_UP).longValueExact();
            long principalPart = i == months ? remaining : Math.min(pmt - interest, remaining);
            LoanSchedule s = new LoanSchedule();
            s.setLoanId(loanId);
            s.setLoanNo(loanNo);
            s.setPeriodNo(i);
            s.setDueDate(start.plusMonths(i));
            s.setPrincipal(principalPart);
            s.setInterest(interest);
            s.setTotal(principalPart + interest);
            s.setStatus(LoanSchedule.ST_PENDING);
            list.add(s);
            remaining -= principalPart;
        }
        return list;
    }
}
