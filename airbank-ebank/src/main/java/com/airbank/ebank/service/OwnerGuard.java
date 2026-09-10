package com.airbank.ebank.service;

import com.airbank.common.api.Result;
import com.airbank.common.exception.BizException;
import com.airbank.common.exception.ErrorCodes;
import com.airbank.common.security.AuthContext;
import com.airbank.common.security.AuthUser;

/**
 * 网银归属校验与下游响应解包。
 * 网银无操作点权限（@RequirePerm 不适用），一律以"本人归属"为授权口径（docs/design/05 §3）：
 * 当前用户 customerId 为空（柜员/管理员访问网银客户接口）按非本人处理 → 6008。
 */
public final class OwnerGuard {

    private OwnerGuard() {
    }

    /** 取当前网银客户 ID；未认证 → 1003，无 customerId（柜员/管理员）→ 6008 */
    public static Long requireCustomerId() {
        AuthUser u = AuthContext.require();
        if (u.customerId() == null) {
            throw BizException.of(ErrorCodes.NOT_OWNER, "仅网银客户本人可执行此操作");
        }
        return u.customerId();
    }

    public static String loginName() {
        AuthUser u = AuthContext.require();
        return u.loginName();
    }

    /** 解包下游 Result：非 ok 抛对应错误码（正常场景 FeignErrorDecoder 已透传），data 为空视为下游异常 */
    public static <T> T data(Result<T> r) {
        if (r == null) {
            throw BizException.of(ErrorCodes.DOWNSTREAM_UNAVAILABLE, "下游服务无响应");
        }
        if (!r.isOk()) {
            throw BizException.of(r.getCode(), r.getMessage());
        }
        return r.getData();
    }
}
