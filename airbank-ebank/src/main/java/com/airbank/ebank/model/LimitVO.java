package com.airbank.ebank.model;

/**
 * 网银转账限额视图。金额单位：分。
 */
public record LimitVO(
        long singleLimit,
        long dailyLimit,
        long usedToday
) {
}
