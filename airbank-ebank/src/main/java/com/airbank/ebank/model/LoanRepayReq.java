package com.airbank.ebank.model;

import jakarta.validation.constraints.NotBlank;

/**
 * 网银贷款还款请求。repayMode：INSTALLMENT 还一期 / SETTLE 提前结清（金额由信贷系统权威计算）。
 */
public record LoanRepayReq(
        @NotBlank String requestNo,
        @NotBlank String loanNo,
        @NotBlank String repayMode,
        @NotBlank String otpCode
) {
}
