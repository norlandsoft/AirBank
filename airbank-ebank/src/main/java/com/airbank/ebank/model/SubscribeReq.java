package com.airbank.ebank.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

/**
 * 理财申购请求（元，两位小数；后端转分）。
 */
public record SubscribeReq(
        @NotBlank(message = "产品代码不能为空") String productCode,
        @NotNull(message = "金额不能为空") BigDecimal amount,
        @NotBlank(message = "短信验证码不能为空") String otpCode,
        @NotBlank(message = "requestNo 不能为空") String requestNo
) {
}
