package com.airbank.common.security;

import java.util.List;

/**
 * 当前登录用户上下文（由 AuthFilter 从 JWT 解析注入）。
 */
public record AuthUser(
        Long userId,
        String loginName,
        String userType,
        List<String> roles,
        List<String> perms,
        Long customerId,
        String branchNo,
        String tellerNo,
        String jti
) {

    public boolean hasRole(String role) {
        return roles != null && roles.contains(role);
    }

    public boolean hasPerm(String perm) {
        return hasRole("ADMIN") || (perms != null && perms.contains(perm));
    }
}
