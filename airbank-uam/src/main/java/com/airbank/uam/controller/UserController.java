package com.airbank.uam.controller;

import com.airbank.common.api.Result;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import com.airbank.common.security.AuthContext;
import com.airbank.common.security.RequirePerm;
import com.airbank.uam.entity.User;
import com.airbank.uam.model.UserCreateCmd;
import com.airbank.uam.service.AdminService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class UserController {

    private final AdminService adminService;

    public record TellerVO(Long id, String tellerNo, String realName, String branchNo, String status,
                           List<String> roles) {
    }

    @GetMapping("/users/tellers")
    @RequirePerm("admin:manage")
    public Result<List<TellerVO>> tellers(@RequestParam(required = false) String keyword) {
        return Result.ok(adminService.listTellers(keyword).stream()
                .map(u -> new TellerVO(u.getId(), u.getTellerNo(), u.getRealName(), u.getBranchNo(),
                        u.getStatus(), adminService.rolesOf(u.getId())))
                .toList());
    }

    @PostMapping("/users/tellers")
    @RequirePerm("admin:manage")
    public Result<Long> createTeller(@Valid @RequestBody UserCreateCmd cmd) {
        return Result.ok(adminService.createTeller(cmd.tellerNo(), cmd.realName(), cmd.branchNo(),
                cmd.roleCode(), cmd.password()).getId());
    }

    public record ResetPwdCmd(@NotBlank @Size(min = 8, max = 20) String password) {
    }

    @PutMapping("/users/tellers/{id}/reset-password")
    @RequirePerm("admin:manage")
    public Result<Void> resetPassword(@PathVariable Long id, @RequestBody ResetPwdCmd cmd) {
        adminService.resetPassword(id, cmd.password());
        return Result.ok();
    }

    public record ChangePwdCmd(String oldPassword, String newPassword) {
    }

    @PutMapping("/profile/password")
    public Result<Void> changePassword(@RequestBody ChangePwdCmd cmd) {
        adminService.changePassword(AuthContext.require().userId(), cmd.oldPassword(), cmd.newPassword());
        return Result.ok();
    }
}
