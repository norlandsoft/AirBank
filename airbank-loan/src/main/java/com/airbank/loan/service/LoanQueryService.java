package com.airbank.loan.service;

import com.airbank.api.loan.dto.LoanAccountVO;
import com.airbank.api.loan.dto.LoanDetailVO;
import com.airbank.api.loan.dto.LoanScheduleVO;
import com.airbank.common.exception.BizException;
import com.airbank.common.exception.ErrorCodes;
import com.airbank.loan.entity.LoanAccount;
import com.airbank.loan.entity.LoanSchedule;
import com.airbank.loan.mapper.LoanAccountMapper;
import com.airbank.loan.mapper.LoanScheduleMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 借据查询服务（docs/design/13 §4.6）。
 */
@Service
@RequiredArgsConstructor
public class LoanQueryService {

    private final LoanAccountMapper loanMapper;
    private final LoanScheduleMapper scheduleMapper;
    private final RepayService repayService;

    public List<LoanAccountVO> listByCustomer(Long customerId) {
        return loanMapper.selectList(new LambdaQueryWrapper<LoanAccount>()
                        .eq(LoanAccount::getCustomerId, customerId)
                        .orderByDesc(LoanAccount::getId).last("LIMIT 100"))
                .stream().map(this::toVo).toList();
    }

    public LoanAccount requireByLoanNo(String loanNo) {
        LoanAccount loan = loanMapper.selectOne(new LambdaQueryWrapper<LoanAccount>()
                .eq(LoanAccount::getLoanNo, loanNo));
        if (loan == null) {
            throw BizException.of(ErrorCodes.LOAN_NOT_FOUND, "借据不存在: " + loanNo);
        }
        return loan;
    }

    public LoanDetailVO detail(String loanNo) {
        LoanAccount loan = requireByLoanNo(loanNo);
        List<LoanScheduleVO> schedules = scheduleMapper.selectList(new LambdaQueryWrapper<LoanSchedule>()
                        .eq(LoanSchedule::getLoanId, loan.getId())
                        .orderByAsc(LoanSchedule::getPeriodNo))
                .stream().map(LoanQueryService::toVo).toList();
        return new LoanDetailVO(toVo(loan), schedules, repayService.listByLoan(loan.getId()));
    }

    LoanAccountVO toVo(LoanAccount l) {
        LoanSchedule next = scheduleMapper.selectOne(new LambdaQueryWrapper<LoanSchedule>()
                .eq(LoanSchedule::getLoanId, l.getId())
                .eq(LoanSchedule::getStatus, LoanSchedule.ST_PENDING)
                .orderByAsc(LoanSchedule::getPeriodNo).last("LIMIT 1"));
        return new LoanAccountVO(l.getLoanNo(), l.getApplyNo(), l.getCustomerId(),
                l.getProductCode(), l.getProductName(), l.getPrincipal(), l.getAnnualRate(),
                l.getTermMonths(), l.getRepayMethod(), l.getAcctNo(),
                l.getDisburseDate() == null ? null : l.getDisburseDate().toString(),
                l.getRemainPrincipal(), l.getPaidPrincipal(), l.getPaidInterest(), l.getStatus(),
                next == null ? null : next.getDueDate().toString(),
                next == null ? null : next.getTotal(),
                l.getChannel(), l.getCreatedAt() == null ? null : l.getCreatedAt().toString());
    }

    private static LoanScheduleVO toVo(LoanSchedule s) {
        return new LoanScheduleVO(s.getPeriodNo(),
                s.getDueDate() == null ? null : s.getDueDate().toString(),
                s.getPrincipal(), s.getInterest(), s.getTotal(), s.getStatus(),
                s.getPaidAt() == null ? null : s.getPaidAt().toString());
    }
}
