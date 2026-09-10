package com.airbank.ebank.model;

import java.util.Map;

/**
 * 电子回单视图。
 */
public record ReceiptVO(
        Long id,
        String receiptNo,
        String bizType,
        String bizNo,
        String createdAt,
        Map<String, Object> content
) {
}
