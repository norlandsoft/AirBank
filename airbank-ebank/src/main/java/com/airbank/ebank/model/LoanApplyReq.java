package com.airbank.ebank.model;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

/**
 * 网银贷款申请请求（金额单位：元，渠道侧转分）。
 */
public record LoanApplyReq(
        @NotBlank String requestNo,
        @NotBlank String productCode,
        @NotNull @DecimalMin("0.01") BigDecimal amount,
        @NotNull Integer termMonths,
        @Size(max = 128) String purpose,
        @NotBlank String otpCode
) {
}
