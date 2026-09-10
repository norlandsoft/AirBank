package com.airbank.counter.model;

/**
 * 工作台看板（GET /dashboard）。
 */
public record DashboardVO(
        long todayCount,
        long todayAmount,
        long cashIn,
        long cashOut,
        long boxBalance,
        long pendingReviews
) {
}
