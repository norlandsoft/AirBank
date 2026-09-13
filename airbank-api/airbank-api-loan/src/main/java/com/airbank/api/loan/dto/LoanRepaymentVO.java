package com.airbank.api.loan.dto;

/**
 * 还款记录视图。金额单位：分。
 */
public record LoanRepaymentVO(
        String repayNo,
        String loanNo,
        String repayMode,
        /** 结清的期次（SETTLE 提前结清为 null） */
        Integer periodNo,
        Long amount,
        Long principalPart,
        Long interestPart,
        String principalTxnNo,
        String interestTxnNo,
        /** SUCCESS / FAILED */
        String status,
        String failReason,
        String createdAt
) {
}
