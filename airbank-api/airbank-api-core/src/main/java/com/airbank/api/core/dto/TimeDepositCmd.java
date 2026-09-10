package com.airbank.api.core.dto;

/**
 * 定期存入命令。amount 单位：分。
 */
public record TimeDepositCmd(
        String requestNo,
        String acctNo,
        int termMonths,
        long amount,
        String operator,
        String channel
) {
}
