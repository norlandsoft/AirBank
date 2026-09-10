package com.airbank.common.feign;

import com.airbank.common.api.Result;
import com.airbank.common.exception.BizException;
import com.fasterxml.jackson.databind.ObjectMapper;
import feign.Response;
import feign.codec.ErrorDecoder;
import lombok.extern.slf4j.Slf4j;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/**
 * Feign 错误解码：下游统一响应 code≠0 时抛 BizException，错误码原样透传（docs/design/07 §4）。
 */
@Slf4j
public class FeignErrorDecoder implements ErrorDecoder {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public Exception decode(String methodKey, Response response) {
        int status = response.status();
        String bodyText = readBody(response);
        if (!bodyText.isBlank()) {
            try {
                Result<?> result = objectMapper.readValue(bodyText, Result.class);
                if (result.getCode() != 0) {
                    return BizException.of(result.getCode(), result.getMessage());
                }
            } catch (BizException e) {
                return e;
            } catch (Exception ignore) {
                // 非 Result 结构，走通用分支
            }
        }
        log.warn("feign call failed: {} status={} body={}", methodKey, status, bodyText);
        return BizException.of(com.airbank.common.exception.ErrorCodes.DOWNSTREAM_UNAVAILABLE,
                "下游服务不可用或响应异常（HTTP " + status + "）");
    }

    private String readBody(Response response) {
        if (response.body() == null) {
            return "";
        }
        try (InputStream is = response.body().asInputStream()) {
            return new String(is.readAllBytes(), StandardCharsets.UTF_8);
        } catch (Exception e) {
            return "";
        }
    }
}
