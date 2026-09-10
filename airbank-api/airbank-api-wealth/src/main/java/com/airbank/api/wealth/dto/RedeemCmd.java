package com.airbank.api.wealth.dto;

/**
 * 赎回命令。shares 单位：份×100（因 1 份 = 1 元 = 100 分，数值上与金额"分"同刻度）。
 */
public record RedeemCmd(
        String requestNo,
        Long customerId,
        String acctNo,
        String productCode,
        long shares,
        String channel,
        String operator
) {
}
