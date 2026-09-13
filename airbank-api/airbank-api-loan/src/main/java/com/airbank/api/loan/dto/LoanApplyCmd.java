package com.airbank.api.loan.dto;

/**
 * 贷款申请命令（渠道 → 信贷系统）。amount 单位：分。
 */
public record LoanApplyCmd(
        String requestNo,
        Long customerId,
        String productCode,
        long amount,
        Integer termMonths,
        String purpose,
        /** 放款/还款账户（本人活期） */
        String acctNo,
        String channel,
        String operator
) {
}
