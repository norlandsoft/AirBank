package com.airbank.api.core.dto;

public record AccountVO(
        Long id,
        String acctNo,
        String cardNo,
        Long customerId,
        String acctType,
        String productCode,
        String status,
        long balance,
        long frozenAmount,
        long accruedInterest,
        String branchNo,
        String openedAt
) {
}
