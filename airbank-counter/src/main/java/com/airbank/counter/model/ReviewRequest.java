package com.airbank.counter.model;

/**
 * 复核意见（approve 可选 / reject 必填）。
 */
public record ReviewRequest(String comment) {
}
