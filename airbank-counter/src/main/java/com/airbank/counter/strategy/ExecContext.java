package com.airbank.counter.strategy;

import com.airbank.counter.entity.CounterTxn;

import java.util.Map;

/**
 * 策略执行上下文。
 */
public record ExecContext(
        CounterTxn txn,
        Map<String, Object> payload,
        String requestNo,
        String tellerNo,
        String branchNo
) {

    public String str(String key) {
        Object v = payload.get(key);
        return v == null ? null : String.valueOf(v);
    }

    public Long longVal(String key) {
        Object v = payload.get(key);
        if (v == null) {
            return null;
        }
        if (v instanceof Number n) {
            return n.longValue();
        }
        try {
            return Long.parseLong(String.valueOf(v));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    public Integer intVal(String key) {
        Object v = payload.get(key);
        if (v == null) {
            return null;
        }
        if (v instanceof Number n) {
            return n.intValue();
        }
        try {
            return Integer.parseInt(String.valueOf(v));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    public long amount() {
        Long a = longVal("amount");
        return a == null ? 0L : a;
    }

    /** 金额（分）转元字符串，用于回执展示 */
    public String amountYuan() {
        return com.airbank.common.util.Money.fenToYuan(amount());
    }
}
