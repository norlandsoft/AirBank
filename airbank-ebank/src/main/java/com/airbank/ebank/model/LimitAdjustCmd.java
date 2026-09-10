package com.airbank.ebank.model;

import java.math.BigDecimal;

/**
 * 限额调整请求（元，最多两位小数；null 表示不调整）。
 * 仅下调免 OTP；上调须短信 OTP（scene=LIMIT）。
 */
public record LimitAdjustCmd(
        BigDecimal singleLimit,
        BigDecimal dailyLimit,
        String otpCode
) {
}
