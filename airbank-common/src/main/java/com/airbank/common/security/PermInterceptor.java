package com.airbank.common.security;

import com.airbank.common.exception.BizException;
import com.airbank.common.exception.ErrorCodes;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

import java.lang.reflect.Method;

/**
 * @RequirePerm 注解校验拦截器：菜单可见性在前端，操作点权限在此强制（双保险）。
 */
public class PermInterceptor implements HandlerInterceptor {

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (!(handler instanceof HandlerMethod hm)) {
            return true;
        }
        Method method = hm.getMethod();
        RequirePerm anno = method.getAnnotation(RequirePerm.class);
        if (anno == null) {
            anno = hm.getBeanType().getAnnotation(RequirePerm.class);
        }
        if (anno == null) {
            return true;
        }
        AuthUser user = AuthContext.get();
        if (user == null) {
            throw BizException.of(ErrorCodes.UNAUTHORIZED, "未认证，请先登录");
        }
        if (!user.hasPerm(anno.value())) {
            throw BizException.of(ErrorCodes.NO_PERMISSION, "无操作权限");
        }
        return true;
    }
}
