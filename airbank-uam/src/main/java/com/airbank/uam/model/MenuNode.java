package com.airbank.uam.model;

import java.util.List;

/**
 * 菜单节点（菜单树在代码中定义，按权限过滤输出，见 docs/deviation.md）。
 */
public record MenuNode(String key, String name, String icon, String path, String perm, List<MenuNode> children) {

    public static MenuNode leaf(String key, String name, String icon, String path, String perm) {
        return new MenuNode(key, name, icon, path, perm, null);
    }

    public static MenuNode group(String key, String name, String icon, String path, List<MenuNode> children) {
        return new MenuNode(key, name, icon, path, null, children);
    }
}
