package com.airbank.wealth.model;

/**
 * 管理端新建产品命令（POST /products，不在 WealthClient 契约内，供管理控制台使用）。
 * 金额单位：分；annualRate 如 "0.0260"；日期 yyyy-MM-dd，可空（默认 募集期=今日起 7 天，成立日=募集结束次日）。
 */
public record ProductCreateCmd(
        String productCode,
        String productName,
        Integer termDays,
        String annualRate,
        String riskLevel,
        Long minAmount,
        Long stepAmount,
        Long maxSingleAmount,
        Long raiseLimit,
        String raiseStartDate,
        String raiseEndDate,
        String valueDate
) {
}
