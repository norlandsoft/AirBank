package com.airbank.ebank.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

/**
 * 行内转账请求（docs/design/05 §3.2）。amount 单位：元（两位小数），后端转分。
 */
public record TransferCmd(
        @NotBlank(message = "requestNo 不能为空") String requestNo,
        @NotBlank(message = "付款账号不能为空") String fromAcct,
        @NotBlank(message = "收款账号不能为空") String toAcct,
        @NotBlank(message = "收款户名不能为空") String toName,
        @NotNull(message = "金额不能为空") BigDecimal amount,
        String summary,
        @NotBlank(message = "短信验证码不能为空") String otpCode
) {
}
