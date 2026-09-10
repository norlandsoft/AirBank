package com.airbank.common.api;

import com.airbank.common.util.Traces;
import lombok.Getter;

import java.io.Serializable;

/**
 * 统一响应结构：code=0 成功，非 0 为业务错误码（见 docs/design/07 §4）。
 */
@Getter
public class Result<T> implements Serializable {

    private final int code;
    private final String message;
    private final T data;
    private final String traceId;
    private final long timestamp;

    private Result(int code, String message, T data) {
        this.code = code;
        this.message = message;
        this.data = data;
        this.traceId = Traces.traceId();
        this.timestamp = System.currentTimeMillis();
    }

    public static <T> Result<T> ok() {
        return new Result<>(0, "success", null);
    }

    public static <T> Result<T> ok(T data) {
        return new Result<>(0, "success", data);
    }

    public static <T> Result<T> fail(int code, String message) {
        return new Result<>(code, message, null);
    }

    public boolean isOk() {
        return code == 0;
    }
}
