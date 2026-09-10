package com.airbank.counter.model;

import com.airbank.counter.entity.CounterTxn;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * 柜面申请单视图（前端对接契约）。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record CtVO(
        Long id,
        String ctNo,
        String bizType,
        String status,
        long amount,
        Map<String, Object> payload,
        Map<String, Object> result,
        String failReason,
        String tellerNo,
        String branchNo,
        String reviewerNo,
        String reviewComment,
        String requestNo,
        LocalDateTime createdAt
) {

    public static CtVO of(CounterTxn t) {
        return new CtVO(t.getId(), t.getCtNo(), t.getBizType(), t.getStatus(),
                t.getAmount() == null ? 0L : t.getAmount(),
                t.getPayload(), t.getResult(), t.getFailReason(),
                t.getTellerNo(), t.getBranchNo(), t.getReviewerNo(), t.getReviewComment(),
                t.getRequestNo(), t.getCreatedAt());
    }
}
