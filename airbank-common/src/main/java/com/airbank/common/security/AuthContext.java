package com.airbank.common.security;

public final class AuthContext {

    private static final ThreadLocal<AuthUser> HOLDER = new ThreadLocal<>();

    private AuthContext() {
    }

    public static void set(AuthUser user) {
        HOLDER.set(user);
    }

    public static AuthUser get() {
        return HOLDER.get();
    }

    public static AuthUser require() {
        AuthUser u = HOLDER.get();
        if (u == null) {
            throw new com.airbank.common.exception.BizException(
                    com.airbank.common.exception.ErrorCodes.UNAUTHORIZED, "未认证");
        }
        return u;
    }

    public static void clear() {
        HOLDER.remove();
    }
}
