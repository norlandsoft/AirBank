package com.airbank.api.wealth.dto;

public record OrderVO(
        String orderNo,
        String orderType,
        String productCode,
        String productName,
        Long customerId,
        String acctNo,
        long amount,
        String shares,
        Long incomeAmount,
        String status,
        String confirmDate,
        String channel,
        String operator,
        String failReason,
        String createdAt
) {
}
