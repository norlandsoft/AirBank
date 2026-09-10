package com.airbank.uam.service;

import com.airbank.common.exception.BizException;
import com.airbank.common.exception.ErrorCodes;
import com.airbank.common.security.AuthUser;
import com.airbank.common.security.JwtUtils;
import com.airbank.common.security.SecurityProperties;
import com.airbank.uam.entity.LoginLog;
import com.airbank.uam.entity.Permission;
import com.airbank.uam.entity.Role;
import com.airbank.uam.entity.RolePermission;
import com.airbank.uam.entity.User;
import com.airbank.uam.entity.UserRole;
import com.airbank.uam.mapper.LoginLogMapper;
import com.airbank.uam.mapper.PermissionMapper;
import com.airbank.uam.mapper.RoleMapper;
import com.airbank.uam.mapper.RolePermissionMapper;
import com.airbank.uam.mapper.UserMapper;
import com.airbank.uam.mapper.UserRoleMapper;
import com.airbank.uam.model.LoginCmd;
import com.airbank.uam.model.LoginVO;
import com.airbank.uam.model.MenuNode;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 认证服务：登录（验证码 → 锁定 → BCrypt）→ JWT 签发（roles+perms claims）→ 登出黑名单（docs/design/05 §1.2）。
 */
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserMapper userMapper;
    private final UserRoleMapper userRoleMapper;
    private final RoleMapper roleMapper;
    private final RolePermissionMapper rolePermissionMapper;
    private final PermissionMapper permissionMapper;
    private final LoginLogMapper loginLogMapper;
    private final CaptchaService captchaService;
    private final MenuService menuService;
    private final PasswordEncoder passwordEncoder;
    private final SecurityProperties securityProps;
    private final StringRedisTemplate redis;

    public LoginVO login(LoginCmd cmd, String ip, String userAgent) {
        captchaService.verify(cmd.captchaUuid(), cmd.captchaCode());
        User user = userMapper.selectOne(new LambdaQueryWrapper<User>()
                .eq(User::getLoginName, cmd.loginName())
                .eq(User::getUserType, cmd.userType()));
        if (user == null) {
            log(null, cmd.loginName(), cmd.userType(), ip, userAgent, "FAIL", "用户不存在");
            throw BizException.of(ErrorCodes.LOGIN_FAILED, "用户名或密码错误");
        }
        if (user.getLockUntil() != null && user.getLockUntil().isAfter(LocalDateTime.now())) {
            throw BizException.of(ErrorCodes.LOGIN_LOCKED, "登录失败次数过多，请 30 分钟后再试");
        }
        if (!passwordEncoder.matches(cmd.password(), user.getPasswordHash())) {
            int fails = user.getFailCount() == null ? 1 : user.getFailCount() + 1;
            user.setFailCount(fails);
            if (fails >= 5) {
                user.setLockUntil(LocalDateTime.now().plusMinutes(30));
            }
            userMapper.updateById(user);
            log(user.getId(), cmd.loginName(), cmd.userType(), ip, userAgent, "FAIL", "密码错误(" + fails + ")");
            throw BizException.of(ErrorCodes.LOGIN_FAILED, "用户名或密码错误");
        }
        user.setFailCount(0);
        user.setLockUntil(null);
        userMapper.updateById(user);

        List<Long> roleIds = userRoleMapper.selectList(new LambdaQueryWrapper<UserRole>()
                        .eq(UserRole::getUserId, user.getId()))
                .stream().map(UserRole::getRoleId).toList();
        List<String> roles = roleIds.isEmpty() ? List.of()
                : roleMapper.selectBatchIds(roleIds).stream().map(Role::getRoleCode).toList();
        List<Long> permIds = roleIds.isEmpty() ? List.of()
                : rolePermissionMapper.selectList(new LambdaQueryWrapper<RolePermission>()
                        .in(RolePermission::getRoleId, roleIds))
                .stream().map(RolePermission::getPermissionId).distinct().toList();
        List<String> perms = permIds.isEmpty() ? List.of()
                : permissionMapper.selectBatchIds(permIds).stream()
                .filter(p -> "ACTION".equals(p.getPermType()))
                .map(Permission::getPermCode).toList();

        AuthUser authUser = new AuthUser(user.getId(), user.getLoginName(), user.getUserType(), roles, perms,
                user.getCustomerId(), user.getBranchNo(), user.getTellerNo(),
                java.util.UUID.randomUUID().toString().replace("-", ""));
        String token = JwtUtils.create(securityProps.getJwtSecret(), securityProps.getJwtExpireMinutes(), authUser);
        log(user.getId(), cmd.loginName(), cmd.userType(), ip, userAgent, "SUCCESS", null);

        return new LoginVO(token, user.getId(), user.getLoginName(), user.getUserType(), user.getRealName(),
                user.getTellerNo(), user.getBranchNo(), user.getCustomerId(), null, null,
                roles, perms, menuService.menusFor(user.getUserType()));
    }

    public List<MenuNode> menus(String userType) {
        return menuService.menusFor(userType);
    }

    public void logout(String jti, long remainSeconds) {
        if (jti != null && remainSeconds > 0) {
            redis.opsForValue().set("jwt:blacklist:" + jti, "1", Duration.ofSeconds(remainSeconds));
        }
    }

    private void log(Long userId, String loginName, String channel, String ip, String ua, String result, String reason) {
        LoginLog l = new LoginLog();
        l.setUserId(userId);
        l.setLoginName(loginName);
        l.setChannel(channel);
        l.setIp(ip);
        l.setUserAgent(ua == null ? "" : ua.substring(0, Math.min(200, ua.length())));
        l.setResult(result);
        l.setReason(reason);
        l.setLoginTime(LocalDateTime.now());
        loginLogMapper.insert(l);
    }
}
