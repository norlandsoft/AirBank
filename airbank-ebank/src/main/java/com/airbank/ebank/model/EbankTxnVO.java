package com.airbank.ebank.model;

/**
 * 网银渠道流水视图（本人）。金额单位：分。
 */
public record EbankTxnVO(
        Long id,
        String requestNo,
        String bizType,
        String acctNo,
        long amount,
        String status,
        String downstreamNo,
        String createdAt,
        String finishedAt
) {
}
