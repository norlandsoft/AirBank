package com.airbank.api.wealth.dto;

/**
 * 申购命令：下单即扣款（核心 WEALTH_SUBSCRIBE），T+1 确认份额。amount 单位：分。
 */
public record SubscribeCmd(
        String requestNo,
        Long customerId,
        String acctNo,
        String productCode,
        long amount,
        String channel,
        String operator
) {
}
