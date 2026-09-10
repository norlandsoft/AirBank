package com.airbank.ebank.model;

/**
 * 注册校验响应：客户存在且手机号匹配，OTP 已发送。
 */
public record RegisterCheckVO(
        Long customerId,
        String customerNameMask,
        String mobileMask
) {
}
