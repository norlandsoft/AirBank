package com.airbank.api.core.dto;

import jakarta.validation.constraints.NotNull;

/**
 * 开户命令：开户即首笔现金存款激活（docs/design/03 §4.1）。initialAmount 单位：分。
 */
public record OpenAccountCmd(
        String requestNo,
        @NotNull Long customerId,
        String acctType,
        long initialAmount,
        String branchNo,
        String operator,
        String channel
) {
}
