package com.airbank.common.feign;

import feign.RequestInterceptor;
import feign.RequestTemplate;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/**
 * Feign 调用透传当前请求的 Authorization / X-Channel 头（渠道 → 领域服务身份传递）。
 */
public class ForwardAuthInterceptor implements RequestInterceptor {

    @Override
    public void apply(RequestTemplate template) {
        if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attrs) {
            HttpServletRequest request = attrs.getRequest();
            copy(request, template, "Authorization");
            copy(request, template, "X-Channel");
        }
    }

    private void copy(HttpServletRequest request, RequestTemplate template, String header) {
        String v = request.getHeader(header);
        if (v != null && !v.isBlank()) {
            template.header(header, v);
        }
    }
}
