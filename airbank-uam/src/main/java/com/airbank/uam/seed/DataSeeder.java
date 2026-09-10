package com.airbank.uam.seed;

import com.airbank.common.security.SecurityProperties;
import com.airbank.common.util.AesGcm;
import com.airbank.common.util.Desensitize;
import com.airbank.uam.entity.Branch;
import com.airbank.uam.entity.Customer;
import com.airbank.uam.entity.Permission;
import com.airbank.uam.entity.Role;
import com.airbank.uam.entity.RolePermission;
import com.airbank.uam.entity.RiskAssessment;
import com.airbank.uam.entity.User;
import com.airbank.uam.entity.UserRole;
import com.airbank.uam.mapper.BranchMapper;
import com.airbank.uam.mapper.CustomerMapper;
import com.airbank.uam.mapper.PermissionMapper;
import com.airbank.uam.mapper.RoleMapper;
import com.airbank.uam.mapper.RolePermissionMapper;
import com.airbank.uam.mapper.RiskAssessmentMapper;
import com.airbank.uam.mapper.SeederMapper;
import com.airbank.uam.mapper.UserMapper;
import com.airbank.uam.mapper.UserRoleMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;

/**
 * 种子数据（幂等）：机构/角色/权限/演示柜员/演示客户（docs/design/06 §8）。
 * 演示密码 Abc12345 —— 仅限培训环境。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DataSeeder implements ApplicationRunner {

    private final BranchMapper branchMapper;
    private final RoleMapper roleMapper;
    private final PermissionMapper permissionMapper;
    private final RolePermissionMapper rolePermissionMapper;
    private final UserMapper userMapper;
    private final UserRoleMapper userRoleMapper;
    private final CustomerMapper customerMapper;
    private final RiskAssessmentMapper riskMapper;
    private final SeederMapper seederMapper;
    private final PasswordEncoder passwordEncoder;
    private final SecurityProperties securityProps;

    private static final List<String[]> BRANCHES = List.of(
            new String[]{"990", "总行营业部", "云端市金融中心 1 号"},
            new String[]{"991", "城东支行", "云端市城东大道 88 号"},
            new String[]{"992", "城西支行", "云端市城西科技园 6 号"});

    private static final String[][] ROLES = {
            {"ADMIN", "系统管理员"}, {"TELLER", "普通柜员"}, {"SUPERVISOR", "主管"}, {"EBANK_USER", "网银客户"}};

    private static final String[][] PERMS = {
            {"counter:customer-create", "客户建立"}, {"counter:customer-query", "客户查询"},
            {"counter:account-open", "开户"}, {"counter:cash", "现金存取"},
            {"counter:transfer", "转账"}, {"counter:time-deposit", "定期业务"},
            {"counter:wealth", "理财代销"}, {"counter:account-admin", "账户管理(冻结/销户)"},
            {"counter:reverse", "当日冲正"}, {"counter:daysettle", "日结签退"},
            {"review:authorize", "复核授权"}, {"admin:manage", "系统管理"}};

    private record DemoCustomer(long id, String name, String idNo, String mobile, String level, int score) {
    }

    private static final List<DemoCustomer> DEMO_CUSTOMERS = List.of(
            new DemoCustomer(1, "张三", "110101199001011234", "13800000001", "C3", 15),
            new DemoCustomer(2, "李四", "110101199202022345", "13800000002", "C2", 11),
            new DemoCustomer(3, "王五", "110101198803033456", "13800000003", "C1", 7));

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (branchMapper.selectCount(null) > 0) {
            return;
        }
        log.info("[seed] seeding AirBank UAM demo data ...");
        for (String[] b : BRANCHES) {
            Branch branch = new Branch();
            branch.setBranchNo(b[0]);
            branch.setBranchName(b[1]);
            branch.setAddress(b[2]);
            branch.setStatus("NORMAL");
            branchMapper.insert(branch);
        }
        for (String[] r : ROLES) {
            Role role = new Role();
            role.setRoleCode(r[0]);
            role.setRoleName(r[1]);
            role.setCreatedAt(LocalDateTime.now());
            roleMapper.insert(role);
        }
        for (int i = 0; i < PERMS.length; i++) {
            Permission p = new Permission();
            p.setPermCode(PERMS[i][0]);
            p.setPermName(PERMS[i][1]);
            p.setPermType("ACTION");
            p.setSort(i + 1);
            p.setCreatedAt(LocalDateTime.now());
            permissionMapper.insert(p);
        }
        // ADMIN/SUPERVISOR 全量权限；TELLER 基础权限；EBANK_USER 无操作点
        grant("ADMIN", PERMS);
        grant("SUPERVISOR", PERMS);
        grant("TELLER", new String[][]{
                {"counter:customer-create", ""}, {"counter:customer-query", ""}, {"counter:account-open", ""},
                {"counter:cash", ""}, {"counter:transfer", ""}, {"counter:time-deposit", ""},
                {"counter:wealth", ""}, {"counter:daysettle", ""}});

        String hash = passwordEncoder.encode("Abc12345");
        createTeller("999999", "系统管理员", "990", "ADMIN", hash);
        createTeller("990001", "张柜员", "990", "TELLER", hash);
        createTeller("990002", "李主管", "990", "SUPERVISOR", hash);

        LocalDate today = LocalDate.now();
        for (DemoCustomer d : DEMO_CUSTOMERS) {
            Customer c = new Customer();
            c.setId(d.id());
            c.setCustomerNo("10" + String.format("%010d", 1000000000L + d.id()));
            c.setCustomerName(d.name());
            c.setIdType("01");
            c.setIdNoEnc(AesGcm.encrypt(d.idNo(), securityProps.getAesKey()));
            c.setIdNoHash(sha256(d.idNo()));
            c.setIdNoMask(Desensitize.idNo(d.idNo()));
            c.setMobileEnc(AesGcm.encrypt(d.mobile(), securityProps.getAesKey()));
            c.setMobileHash(sha256(d.mobile()));
            c.setMobileMask(Desensitize.mobile(d.mobile()));
            c.setGender("M");
            c.setOccupation("职员");
            c.setAddress("云端市");
            c.setRiskLevel(d.level());
            c.setRiskAssessDate(today.minusDays(30));
            c.setStatus("NORMAL");
            customerMapper.insert(c);

            RiskAssessment ra = new RiskAssessment();
            ra.setCustomerId(d.id());
            ra.setScore(d.score());
            ra.setLevel(d.level());
            ra.setAnswers("[3,3,3,3,3]");
            ra.setAssessDate(today.minusDays(30));
            ra.setExpireDate(today.plusYears(1).minusDays(30));
            ra.setCreatedAt(LocalDateTime.now());
            riskMapper.insert(ra);

            User u = new User();
            String loginName = switch (d.name()) {
                case "张三" -> "zhangsan";
                case "李四" -> "lisi";
                default -> "wangwu";
            };
            u.setUserType(User.TYPE_CUSTOMER);
            u.setLoginName(loginName);
            u.setPasswordHash(hash);
            u.setCustomerId(d.id());
            u.setRealName(d.name());
            u.setMobileMask(Desensitize.mobile(d.mobile()));
            u.setStatus("NORMAL");
            u.setFailCount(0);
            userMapper.insert(u);
            Role ebankRole = roleMapper.selectOne(new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<Role>()
                    .eq(Role::getRoleCode, "EBANK_USER"));
            UserRole ur = new UserRole();
            ur.setUserId(u.getId());
            ur.setRoleId(ebankRole.getId());
            userRoleMapper.insert(ur);
        }
        seederMapper.setCustomerSeq(seederMapper.maxCustomerId() + 1); // 返回值即 setval 结果
        log.info("[seed] UAM demo data ready (tellers 990001/990002/999999, customers zhangsan/lisi/wangwu, pwd Abc12345).");
    }

    private void createTeller(String no, String name, String branch, String roleCode, String pwdHash) {
        User u = new User();
        u.setUserType("ADMIN".equals(roleCode) ? User.TYPE_ADMIN : User.TYPE_TELLER);
        u.setLoginName(no);
        u.setPasswordHash(pwdHash);
        u.setTellerNo(no);
        u.setBranchNo(branch);
        u.setRealName(name);
        u.setStatus("NORMAL");
        u.setFailCount(0);
        userMapper.insert(u);
        Role role = roleMapper.selectOne(new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<Role>()
                .eq(Role::getRoleCode, roleCode));
        UserRole ur = new UserRole();
        ur.setUserId(u.getId());
        ur.setRoleId(role.getId());
        userRoleMapper.insert(ur);
    }

    private void grant(String roleCode, String[][] perms) {
        Role role = roleMapper.selectOne(new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<Role>()
                .eq(Role::getRoleCode, roleCode));
        for (String[] perm : perms) {
            Permission p = permissionMapper.selectOne(new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<Permission>()
                    .eq(Permission::getPermCode, perm[0]));
            RolePermission rp = new RolePermission();
            rp.setRoleId(role.getId());
            rp.setPermissionId(p.getId());
            rolePermissionMapper.insert(rp);
        }
    }

    private String sha256(String v) {
        try {
            return HexFormat.of().formatHex(
                    MessageDigest.getInstance("SHA-256").digest(v.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
