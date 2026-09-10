package com.airbank.common.util;

import org.slf4j.MDC;

public final class Traces {

    private Traces() {
    }

    public static String traceId() {
        String t = MDC.get("traceId");
        return t == null ? "" : t;
    }
}
