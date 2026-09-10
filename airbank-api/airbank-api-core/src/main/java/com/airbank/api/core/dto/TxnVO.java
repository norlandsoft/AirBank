package com.airbank.api.core.dto;

public record TxnVO(
        String txnNo,
        String requestNo,
        String txnType,
        String fromAcct,
        String toAcct,
        long amount,
        String summary,
        String channel,
        String operator,
        String status,
        String batchDate,
        boolean duplicated,
        Long fromBalanceAfter,
        Long toBalanceAfter,
        String finishedAt
) {
}
