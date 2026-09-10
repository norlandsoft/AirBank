package com.airbank.counter.model;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * 回执视图（含申请单号便于打印关联）。
 */
public record VoucherVO(
        Long id,
        Long ctTxnId,
        String ctNo,
        String voucherNo,
        String voucherType,
        Map<String, Object> content,
        LocalDateTime generatedAt
) {
}
