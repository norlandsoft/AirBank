package com.airbank.ebank.model;

import jakarta.validation.constraints.NotBlank;

/**
 * OTP 发送/查看请求（scene: TRANSFER / LIMIT / WEALTH）。
 */
public record OtpCmd(
        @NotBlank(message = "scene 不能为空") String scene
) {
}
