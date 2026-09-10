package com.airbank.api.core.dto;

/**
 * 账户状态变更：action ∈ FREEZE / UNFREEZE / STOP_PAYMENT / RESUME_PAYMENT / CLOSE。
 */
public record AccountStatusCmd(
        String requestNo,
        String action,
        String operator,
        String reason
) {
}
