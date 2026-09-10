package com.airbank.common.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * JWT（HS256）签发与解析。签发端为 uam，其余服务仅解析校验（docs/design/05 §1.2）。
 */
public final class JwtUtils {

    private JwtUtils() {
    }

    private static SecretKey key(String secret) {
        return Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    public static String create(String secret, long expireMinutes, AuthUser user) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("userType", user.userType());
        claims.put("roles", user.roles());
        claims.put("perms", user.perms());
        if (user.customerId() != null) {
            claims.put("customerId", user.customerId());
        }
        if (user.branchNo() != null) {
            claims.put("branchNo", user.branchNo());
        }
        if (user.tellerNo() != null) {
            claims.put("tellerNo", user.tellerNo());
        }
        Date now = new Date();
        return Jwts.builder()
                .id(user.jti() == null ? UUID.randomUUID().toString().replace("-", "") : user.jti())
                .subject(user.loginName())
                .claims(claims)
                .issuedAt(now)
                .expiration(new Date(now.getTime() + expireMinutes * 60_000))
                .signWith(key(secret))
                .compact();
    }

    /** 解析并校验签名/过期；失败抛 JwtException */
    @SuppressWarnings("unchecked")
    public static AuthUser parse(String secret, String token) {
        Claims c = Jwts.parser().verifyWith(key(secret)).build()
                .parseSignedClaims(token).getPayload();
        Long customerId = c.get("customerId", Number.class) == null ? null : c.get("customerId", Number.class).longValue();
        return new AuthUser(
                c.get("userId", Number.class) == null ? null : c.get("userId", Number.class).longValue(),
                c.getSubject(),
                c.get("userType", String.class),
                (List<String>) c.get("roles", List.class),
                (List<String>) c.get("perms", List.class),
                customerId,
                c.get("branchNo", String.class),
                c.get("tellerNo", String.class),
                c.getId()
        );
    }
}
