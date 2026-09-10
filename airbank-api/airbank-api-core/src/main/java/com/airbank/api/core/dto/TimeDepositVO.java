package com.airbank.api.core.dto;

public record TimeDepositVO(
        Long id,
        String depositNo,
        String acctNo,
        int termMonths,
        String annualRate,
        long amount,
        String valueDate,
        String maturityDate,
        long interest,
        String status,
        String paidAt
) {
}
