package com.airbank.api.uam.dto;

/**
 * 客户视图（敏感字段脱敏后输出）。
 */
public record CustomerDTO(
        Long id,
        String customerNo,
        String customerName,
        String idType,
        String idNoMask,
        String mobileMask,
        String gender,
        String occupation,
        String address,
        String riskLevel,
        String riskAssessDate,
        String status
) {
}
