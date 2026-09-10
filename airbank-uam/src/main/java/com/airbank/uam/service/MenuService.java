package com.airbank.uam.service;

import com.airbank.uam.entity.User;
import com.airbank.uam.model.MenuNode;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 菜单树定义（代码内维护，按权限过滤；见 docs/deviation.md「菜单定义方式」）。
 */
@Service
public class MenuService {

    public List<MenuNode> menusFor(String userType) {
        return User.TYPE_CUSTOMER.equals(userType) ? ebankMenus() : counterMenus();
    }

    public List<MenuNode> counterMenus() {
        return List.of(
                MenuNode.leaf("workbench", "工作台", "DashboardOutlined", "/workbench", null),
                MenuNode.group("biz", "业务办理", "BankOutlined", "/biz", List.of(
                        MenuNode.leaf("account-open", "开户", "UserAddOutlined", "/biz/account-open", "counter:account-open"),
                        MenuNode.leaf("cash-deposit", "现金存款", "PayCircleOutlined", "/biz/cash-deposit", "counter:cash"),
                        MenuNode.leaf("cash-withdraw", "现金取款", "MoneyCollectOutlined", "/biz/cash-withdraw", "counter:cash"),
                        MenuNode.leaf("transfer", "转账", "SwapOutlined", "/biz/transfer", "counter:transfer"),
                        MenuNode.leaf("time-deposit", "定期业务", "SaveOutlined", "/biz/time-deposit", "counter:time-deposit"),
                        MenuNode.leaf("wealth", "理财代销", "GoldOutlined", "/biz/wealth", "counter:wealth"),
                        MenuNode.leaf("account-manage", "账户管理", "LockOutlined", "/biz/account-manage", "counter:account-admin")
                )),
                MenuNode.leaf("review", "待复核授权", "AuditOutlined", "/review", "review:authorize"),
                MenuNode.leaf("customer", "客户查询", "TeamOutlined", "/customer", "counter:customer-query"),
                MenuNode.leaf("reverse", "当日冲正", "RollbackOutlined", "/reverse", "counter:reverse"),
                MenuNode.leaf("vouchers", "回执查询", "FileTextOutlined", "/vouchers", null),
                MenuNode.leaf("daysettle", "日结签退", "CheckSquareOutlined", "/daysettle", "counter:daysettle"),
                MenuNode.group("admin", "系统管理", "SettingOutlined", "/admin", List.of(
                        MenuNode.leaf("admin-tellers", "柜员管理", "UserOutlined", "/admin/tellers", "admin:manage"),
                        MenuNode.leaf("admin-branches", "机构管理", "ApartmentOutlined", "/admin/branches", "admin:manage"),
                        MenuNode.leaf("admin-roles", "角色权限", "SafetyOutlined", "/admin/roles", "admin:manage"),
                        MenuNode.leaf("admin-params", "参数配置", "ControlOutlined", "/admin/params", "admin:manage"),
                        MenuNode.leaf("admin-batch", "日终批量", "ClockCircleOutlined", "/admin/batch", "admin:manage"),
                        MenuNode.leaf("admin-factory", "造数工厂", "ToolOutlined", "/admin/factory", "admin:manage")
                ))
        );
    }

    public List<MenuNode> ebankMenus() {
        return List.of(
                MenuNode.leaf("home", "资产总览", "HomeOutlined", "/home", null),
                MenuNode.leaf("transfer", "转账汇款", "SwapOutlined", "/transfer", null),
                MenuNode.leaf("wealth", "理财", "GoldOutlined", "/wealth", null),
                MenuNode.leaf("accounts", "我的账户", "WalletOutlined", "/accounts", null),
                MenuNode.leaf("receipts", "电子回单", "FileTextOutlined", "/receipts", null),
                MenuNode.leaf("risk", "风险测评", "SafetyCertificateOutlined", "/risk", null),
                MenuNode.leaf("messages", "消息中心", "BellOutlined", "/messages", null),
                MenuNode.leaf("settings", "安全设置", "SettingOutlined", "/settings", null)
        );
    }
}
