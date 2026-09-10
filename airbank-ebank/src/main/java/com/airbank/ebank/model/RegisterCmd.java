package com.airbank.ebank.model;

import jakarta.validation.constraints.NotBlank;

/**
 * 网银自助注册请求。
 */
public record RegisterCmd(
        @NotBlank(message = "客户号不能为空") String customerNo,
        @NotBlank(message = "手机号不能为空") String mobile,
        @NotBlank(message = "登录名不能为空") String loginName,
        @NotBlank(message = "密码不能为空") String password,
        @NotBlank(message = "短信验证码不能为空") String otpCode
) {
}
