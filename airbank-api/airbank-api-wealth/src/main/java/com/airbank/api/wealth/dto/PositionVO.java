package com.airbank.api.wealth.dto;

public record PositionVO(
        Long id,
        String productCode,
        String productName,
        String riskLevel,
        String productStatus,
        String shares,
        long costAmount,
        long accruingIncome,
        long paidIncome,
        String firstBuyDate
) {
}
