package com.airbank.api.loan.dto;

import java.math.BigDecimal;

/**
 * 借据（贷款台账）视图。金额单位：分。
 * 状态机：REPAYING（还款中）→ SETTLED（已结清）。
 */
public record LoanAccountVO(
        String loanNo,
        String applyNo,
        Long customerId,
        String productCode,
        String productName,
        Long principal,
        BigDecimal annualRate,
        Integer termMonths,
        String repayMethod,
        String acctNo,
        String disburseDate,
        Long remainPrincipal,
        Long paidPrincipal,
        Long paidInterest,
        String status,
        /** 下一期应还日/应还额（全部结清后为 null） */
        String nextDueDate,
        Long nextDueAmount,
        String channel,
        String createdAt
) {
}
