package com.airbank.api.loan.dto;

import java.math.BigDecimal;

/**
 * 贷款申请视图（含联网核查/征信/审批结论）。
 * 状态机：SUBMITTED → ID_CHECKED → CREDIT_CHECKED → APPROVED / REJECTED → DISBURSED / DISBURSE_FAILED。
 */
public record LoanApplicationVO(
        String applyNo,
        String requestNo,
        Long customerId,
        String productCode,
        String productName,
        Long amount,
        Integer termMonths,
        String purpose,
        String acctNo,
        String status,
        /** 联网核查结果：PASS / MISMATCH */
        String idCheckResult,
        /** 征信分（mock） */
        Integer creditScore,
        /** 批准金额（分，可能低于申请金额 = 部分批准） */
        Long approveAmount,
        /** 批准利率（年化小数，征信风险加点后） */
        BigDecimal approveRate,
        String rejectReason,
        /** 放款成功后的借据号 */
        String loanNo,
        String channel,
        String operator,
        String createdAt
) {
}
