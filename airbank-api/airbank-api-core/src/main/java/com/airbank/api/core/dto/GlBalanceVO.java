package com.airbank.api.core.dto;

public record GlBalanceVO(
        String batchDate,
        String subjectCode,
        String subjectName,
        long drSum,
        long crSum,
        long balance
) {
}
