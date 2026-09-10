package com.airbank.gateway.support;

import java.time.Instant;

public final class Json {

    private Json() {
    }

    /** 极简 JSON 转义，仅用于固定错误响应体 */
    public static String toJson(int code, String message) {
        String safe = message == null ? "" : message.replace("\\", "\\\\").replace("\"", "\\\"");
        return "{\"code\":" + code + ",\"message\":\"" + safe + "\",\"data\":null,\"traceId\":\"\",\"timestamp\":"
                + Instant.now().toEpochMilli() + "}";
    }
}
