package com.airbank.gateway.filter;

import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.net.InetSocketAddress;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 轻量级网关限流：每 IP 滑动窗口计数（默认 200 次/10 秒），保护全行入口。
 * 注：设计文档中的 Sentinel 网关流控在 v1 以此内置实现替代（见 docs/deviation.md）。
 */
@Slf4j
@Component
public class RateLimitGlobalFilter implements GlobalFilter, Ordered {

    private static final int LIMIT = 200;
    private static final long WINDOW_MS = 10_000L;

    private final Map<String, Deque<Long>> windows = new ConcurrentHashMap<>();

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        InetSocketAddress remote = exchange.getRequest().getRemoteAddress();
        String ip = remote == null ? "unknown" : remote.getAddress().getHostAddress();
        long now = System.currentTimeMillis();
        Deque<Long> deque = windows.computeIfAbsent(ip, k -> new ArrayDeque<>());
        boolean allowed;
        synchronized (deque) {
            while (!deque.isEmpty() && now - deque.peekFirst() > WINDOW_MS) {
                deque.pollFirst();
            }
            allowed = deque.size() < LIMIT;
            if (allowed) {
                deque.addLast(now);
            }
        }
        if (windows.size() > 10_000) {
            windows.clear();
        }
        if (allowed) {
            return chain.filter(exchange);
        }
        log.warn("rate limited ip={}", ip);
        ServerHttpResponse response = exchange.getResponse();
        response.setStatusCode(HttpStatus.TOO_MANY_REQUESTS);
        response.getHeaders().setContentType(MediaType.APPLICATION_JSON);
        byte[] body = ("{\"code\":7003,\"message\":\"请求过于频繁，请稍后再试\",\"data\":null,\"traceId\":\"\",\"timestamp\":"
                + now + "}").getBytes();
        return response.writeWith(Mono.just(response.bufferFactory().wrap(body)));
    }

    @Override
    public int getOrder() {
        return -200;
    }
}
