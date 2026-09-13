package com.airbank.api.loan.dto;

import java.util.List;

/**
 * 借据详情：台账 + 还款计划 + 还款记录。
 */
public record LoanDetailVO(
        LoanAccountVO account,
        List<LoanScheduleVO> schedules,
        List<LoanRepaymentVO> repayments
) {
}
