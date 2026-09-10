package com.airbank.ebank.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * 理财赎回请求。shares 单位：份×100（与金额"分"同刻度）。
 */
public record RedeemReq(
        @NotBlank(message = "产品代码不能为空") String productCode,
        @NotNull(message = "份额不能为空") Long shares,
        @NotBlank(message = "短信验证码不能为空") String otpCode,
        @NotBlank(message = "requestNo 不能为空") String requestNo
) {
}
