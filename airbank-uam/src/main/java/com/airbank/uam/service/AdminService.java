package com.airbank.uam.service;

import com.airbank.common.exception.BizException;
import com.airbank.common.exception.ErrorCodes;
import com.airbank.uam.entity.Branch;
import com.airbank.uam.entity.Permission;
import com.airbank.uam.entity.Role;
import com.airbank.uam.entity.RolePermission;
import com.airbank.uam.entity.User;
import com.airbank.uam.entity.UserRole;
import com.airbank.uam.mapper.BranchMapper;
import com.airbank.uam.mapper.PermissionMapper;
import com.airbank.uam.mapper.RoleMapper;
import com.airbank.uam.mapper.RolePermissionMapper;
import com.airbank.uam.mapper.UserMapper;
import com.airbank.uam.mapper.UserRoleMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 管理端：柜员 / 机构 / 角色 / 权限。
 */
@Service
@RequiredArgsConstructor
public class AdminService {

    private final UserMapper userMapper;
    private final UserRoleMapper userRoleMapper;
    private final RoleMapper roleMapper;
    private final RolePermissionMapper rolePermissionMapper;
    private final PermissionMapper permissionMapper;
    private final BranchMapper branchMapper;
    private final PasswordEncoder passwordEncoder;

    // —— 柜员 ——

    @Transactional
    public User createTeller(String tellerNo, String realName, String branchNo, String roleCode, String password) {
        if (userMapper.selectCount(new LambdaQueryWrapper<User>().eq(User::getLoginName, tellerNo)) > 0
                || userMapper.selectCount(new LambdaQueryWrapper<User>().eq(User::getTellerNo, tellerNo)) > 0) {
            throw BizException.of(ErrorCodes.LOGIN_NAME_EXISTS, "柜员工号已存在");
        }
        User u = new User();
        u.setUserType(User.TYPE_TELLER);
        u.setLoginName(tellerNo);
        u.setPasswordHash(passwordEncoder.encode(password));
        u.setTellerNo(tellerNo);
        u.setBranchNo(branchNo);
        u.setRealName(realName);
        u.setStatus("NORMAL");
        u.setFailCount(0);
        userMapper.insert(u);
        assignRole(u.getId(), roleCode);
        return u;
    }

    /** 网银注册：创建 CUSTOMER 用户并授 EBANK_USER 角色（docs/design/05 §3.1） */
    @Transactional
    public User createCustomerUser(Long customerId, String loginName, String password, String realName, String mobileMask) {
        if (userMapper.selectCount(new LambdaQueryWrapper<User>().eq(User::getLoginName, loginName)) > 0) {
            throw BizException.of(ErrorCodes.LOGIN_NAME_EXISTS, "登录名已存在");
        }
        if (userMapper.selectCount(new LambdaQueryWrapper<User>().eq(User::getCustomerId, customerId)) > 0) {
            throw BizException.of(ErrorCodes.LOGIN_NAME_EXISTS, "该客户已注册网银");
        }
        User u = new User();
        u.setUserType(User.TYPE_CUSTOMER);
        u.setLoginName(loginName);
        u.setPasswordHash(passwordEncoder.encode(password));
        u.setCustomerId(customerId);
        u.setRealName(realName);
        u.setMobileMask(mobileMask);
        u.setStatus("NORMAL");
        u.setFailCount(0);
        userMapper.insert(u);
        assignRole(u.getId(), "EBANK_USER");
        return u;
    }

    public void resetPassword(Long userId, String newPassword) {
        User u = userMapper.selectById(userId);
        if (u == null) {
            throw BizException.of(ErrorCodes.NOT_FOUND, "用户不存在");
        }
        u.setPasswordHash(passwordEncoder.encode(newPassword));
        u.setFailCount(0);
        u.setLockUntil(null);
        userMapper.updateById(u);
    }

    public void changePassword(Long userId, String oldPassword, String newPassword) {
        User u = userMapper.selectById(userId);
        if (u == null || !passwordEncoder.matches(oldPassword, u.getPasswordHash())) {
            throw BizException.of(ErrorCodes.LOGIN_FAILED, "原密码错误");
        }
        u.setPasswordHash(passwordEncoder.encode(newPassword));
        userMapper.updateById(u);
    }

    public List<User> listTellers(String keyword) {
        LambdaQueryWrapper<User> qw = new LambdaQueryWrapper<User>()
                .in(User::getUserType, User.TYPE_TELLER, User.TYPE_ADMIN)
                .orderByDesc(User::getId);
        if (StringUtils.hasText(keyword)) {
            qw.and(w -> w.like(User::getLoginName, keyword).or().like(User::getRealName, keyword));
        }
        return userMapper.selectList(qw);
    }

    public List<String> rolesOf(Long userId) {
        List<Long> roleIds = userRoleMapper.selectList(new LambdaQueryWrapper<UserRole>().eq(UserRole::getUserId, userId))
                .stream().map(UserRole::getRoleId).toList();
        return roleIds.isEmpty() ? List.of()
                : roleMapper.selectBatchIds(roleIds).stream().map(Role::getRoleCode).toList();
    }

    // —— 角色/权限 ——

    public List<Role> listRoles() {
        return roleMapper.selectList(new LambdaQueryWrapper<Role>().orderByAsc(Role::getId));
    }

    public List<Permission> listPerms() {
        return permissionMapper.selectList(new LambdaQueryWrapper<Permission>().orderByAsc(Permission::getSort));
    }

    public Map<Long, List<String>> rolePerms() {
        return rolePermissionMapper.selectList(null).stream()
                .collect(Collectors.groupingBy(RolePermission::getRoleId,
                        Collectors.mapping(rp -> String.valueOf(rp.getPermissionId()), Collectors.toList())));
    }

    @Transactional
    public void updateRolePerms(Long roleId, List<Long> permIds) {
        rolePermissionMapper.delete(new LambdaQueryWrapper<RolePermission>().eq(RolePermission::getRoleId, roleId));
        for (Long pid : permIds) {
            RolePermission rp = new RolePermission();
            rp.setRoleId(roleId);
            rp.setPermissionId(pid);
            rolePermissionMapper.insert(rp);
        }
    }

    // —— 机构 ——

    public List<Branch> listBranches() {
        return branchMapper.selectList(new LambdaQueryWrapper<Branch>().orderByAsc(Branch::getBranchNo));
    }

    private void assignRole(Long userId, String roleCode) {
        Role role = roleMapper.selectOne(new LambdaQueryWrapper<Role>().eq(Role::getRoleCode, roleCode));
        if (role == null) {
            throw BizException.of(ErrorCodes.NOT_FOUND, "角色不存在: " + roleCode);
        }
        UserRole ur = new UserRole();
        ur.setUserId(userId);
        ur.setRoleId(role.getId());
        userRoleMapper.insert(ur);
    }
}
