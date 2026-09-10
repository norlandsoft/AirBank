package com.airbank.wealth.model;

/**
 * 到期清算报告（GET /settlement/reports）：产品维度本金/收益汇总。
 */
public record SettlementReportVO(
        String batchNo,
        String productCode,
        String productName,
        String batchDate,
        long principalTotal,
        long incomeTotal,
        String status,
        String createdAt
) {
}
