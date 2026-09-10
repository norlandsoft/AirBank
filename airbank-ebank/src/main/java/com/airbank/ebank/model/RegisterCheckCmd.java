package com.airbank.ebank.model;

import jakarta.validation.constraints.NotBlank;

/**
 * 注册校验请求：客户号 + 预留手机号（docs/design/05 §3.1）。
 */
public record RegisterCheckCmd(
        @NotBlank(message = "客户号不能为空") String customerNo,
        @NotBlank(message = "手机号不能为空") String mobile
) {
}
