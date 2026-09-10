package com.airbank.api.wealth.dto;

public record ProductVO(
        Long id,
        String productCode,
        String productName,
        int termDays,
        String annualRate,
        String riskLevel,
        long minAmount,
        long stepAmount,
        long maxSingleAmount,
        long raiseLimit,
        long raisedAmount,
        String raiseStartDate,
        String raiseEndDate,
        String valueDate,
        String maturityDate,
        String status,
        String redeemFeeRate
) {
}
