package com.airbank.api.loan.dto;

/**
 * 还款计划（等额本息分期）视图。金额单位：分。
 */
public record LoanScheduleVO(
        Integer periodNo,
        String dueDate,
        Long principal,
        Long interest,
        Long total,
        /** PENDING 待还 / PAID 已还 */
        String status,
        String paidAt
) {
}
