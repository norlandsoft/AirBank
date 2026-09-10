package com.airbank.uam.model;

import jakarta.validation.constraints.NotBlank;

/**
 * 登录命令：柜面以工号登录（userType=TELLER），网银以登录名登录（userType=CUSTOMER）。
 */
public record LoginCmd(
        @NotBlank(message = "登录名不能为空") String loginName,
        @NotBlank(message = "密码不能为空") String password,
        @NotBlank(message = "用户类型不能为空") String userType,
        @NotBlank(message = "验证码不能为空") String captchaUuid,
        @NotBlank(message = "验证码不能为空") String captchaCode
) {
}
