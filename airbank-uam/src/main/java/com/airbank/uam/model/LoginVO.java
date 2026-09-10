package com.airbank.uam.model;

import java.util.List;

/**
 * 登录结果：token + 用户信息 + 权限 + 菜单树。
 */
public record LoginVO(
        String token,
        Long userId,
        String loginName,
        String userType,
        String realName,
        String tellerNo,
        String branchNo,
        Long customerId,
        String customerNo,
        String riskLevel,
        List<String> roles,
        List<String> perms,
        List<MenuNode> menus
) {
}
