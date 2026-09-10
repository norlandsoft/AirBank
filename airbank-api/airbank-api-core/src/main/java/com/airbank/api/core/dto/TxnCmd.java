package com.airbank.api.core.dto;

/**
 * 核心统一记账命令：所有资金变动唯一入口（docs/design/03 §2.2）。
 * amount 单位：分。
 */
public record TxnCmd(
        String requestNo,
        String txnType,
        String fromAcct,
        String toAcct,
        long amount,
        String summary,
        String channel,
        String operator,
        String branchNo
) {
}
