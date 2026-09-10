package com.airbank.ebank.model;

/**
 * 转账结果视图。金额单位：分。
 */
public record TransferVO(
        String requestNo,
        String fromAcct,
        String toAcct,
        String toName,
        long amount,
        String summary,
        String status,
        String txnNo,
        String receiptNo,
        Long fromBalanceAfter,
        String finishedAt,
        boolean duplicated
) {
}
