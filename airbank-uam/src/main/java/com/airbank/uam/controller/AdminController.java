package com.airbank.uam.controller;

import com.airbank.common.api.Result;
import com.airbank.common.security.RequirePerm;
import com.airbank.uam.entity.Branch;
import com.airbank.uam.entity.Permission;
import com.airbank.uam.entity.Role;
import com.airbank.uam.service.AdminService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class AdminController {

    private final AdminService adminService;

    @GetMapping("/roles")
    @RequirePerm("admin:manage")
    public Result<List<Role>> roles() {
        return Result.ok(adminService.listRoles());
    }

    @GetMapping("/permissions")
    @RequirePerm("admin:manage")
    public Result<List<Permission>> permissions() {
        return Result.ok(adminService.listPerms());
    }

    public record RolePermsCmd(List<Long> permIds) {
    }

    @PutMapping("/roles/{id}/perms")
    @RequirePerm("admin:manage")
    public Result<Void> updateRolePerms(@PathVariable Long id, @RequestBody RolePermsCmd cmd) {
        adminService.updateRolePerms(id, cmd.permIds());
        return Result.ok();
    }

    @GetMapping("/branches")
    public Result<List<Branch>> branches() {
        return Result.ok(adminService.listBranches());
    }
}
