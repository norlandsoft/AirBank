package com.airbank.common.security;

import com.airbank.common.api.Result;
import com.airbank.common.exception.ErrorCodes;
import com.airbank.common.util.Traces;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * 认证过滤器：解析 JWT → AuthContext；登出黑名单（Redis）；白名单放行。
 */
@Slf4j
@RequiredArgsConstructor
public class AuthFilter extends OncePerRequestFilter {

    private static final AntPathMatcher MATCHER = new AntPathMatcher();
    private final SecurityProperties props;
    private final ObjectMapper objectMapper;
    private final StringRedisTemplate redis;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if (!props.isEnabled() || "OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }
        String path = request.getServletPath();
        return props.getExcludePaths().stream().anyMatch(p -> MATCHER.match(p, path));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        try {
            String auth = request.getHeader("Authorization");
            if (auth == null || !auth.startsWith("Bearer ")) {
                reject(response, ErrorCodes.UNAUTHORIZED, "未认证，请先登录");
                return;
            }
            AuthUser user;
            try {
                user = JwtUtils.parse(props.getJwtSecret(), auth.substring(7));
            } catch (io.jsonwebtoken.JwtException e) {
                reject(response, ErrorCodes.TOKEN_INVALID, "登录凭证无效或已过期");
                return;
            }
            if (isLoggedOut(user.jti())) {
                reject(response, ErrorCodes.TOKEN_LOGOUT, "登录已失效，请重新登录");
                return;
            }
            AuthContext.set(user);
            chain.doFilter(request, response);
        } finally {
            AuthContext.clear();
        }
    }

    private boolean isLoggedOut(String jti) {
        if (jti == null) {
            return false;
        }
        try {
            Boolean exists = redis.hasKey("jwt:blacklist:" + jti);
            return Boolean.TRUE.equals(exists);
        } catch (Exception e) {
            log.warn("redis unavailable, skip jwt blacklist check: {}", e.getMessage());
            return false;
        }
    }

    private void reject(HttpServletResponse response, int code, String message) throws IOException {
        response.setStatus(HttpServletResponse.SC_OK);
        response.setContentType("application/json;charset=UTF-8");
        Result<Void> body = Result.fail(code, message);
        response.getOutputStream().write(objectMapper.writeValueAsBytes(body));
    }
}
