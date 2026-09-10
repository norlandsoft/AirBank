package com.airbank.api.core.dto;

/**
 * 批量任务状态。
 */
public record BatchVO(
        Long id,
        String batchType,
        String batchDate,
        String status,
        String currentStep,
        String startedAt,
        String finishedAt
) {
}
