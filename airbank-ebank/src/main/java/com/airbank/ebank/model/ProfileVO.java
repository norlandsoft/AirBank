package com.airbank.ebank.model;

/**
 * 个人信息视图（敏感字段脱敏）。
 */
public record ProfileVO(
        String customerNo,
        String name,
        String mobileMask,
        String riskLevel
) {
}
