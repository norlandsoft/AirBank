package com.airbank.uam.controller;

import com.airbank.api.uam.dto.CustomerCreateCmd;
import com.airbank.api.uam.dto.CustomerDTO;
import com.airbank.common.api.Result;
import com.airbank.common.exception.BizException;
import com.airbank.common.exception.ErrorCodes;
import com.airbank.uam.entity.Customer;
import com.airbank.uam.service.AdminService;
import com.airbank.uam.service.CustomerService;
import com.airbank.uam.service.OtpService;
import com.airbank.uam.service.RiskService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 服务间内部契约（/internal/**，仅内网可达，docs/design/07 §7）。
 */
@RestController
@RequestMapping("/internal")
@RequiredArgsConstructor
public class InternalController {

    private final CustomerService customerService;
    private final AdminService adminService;
    private final OtpService otpService;
    private final RiskService riskService;

    @PostMapping("/customers")
    public Result<CustomerDTO> createCustomer(@Valid @RequestBody CustomerCreateCmd cmd) {
        return Result.ok(customerService.create(cmd));
    }

    @GetMapping("/customers/{id}")
    public Result<CustomerDTO> customer(@PathVariable Long id) {
        return Result.ok(customerService.toDto(customerService.requireEntity(id)));
    }

    @GetMapping("/customers/by-id-no")
    public Result<CustomerDTO> byIdNo(@RequestParam String idNo) {
        Customer c = customerService.byIdNo(idNo);
        return Result.ok(c == null ? null : customerService.toDto(c));
    }

    @GetMapping("/customers/by-customer-no")
    public Result<CustomerDTO> byCustomerNo(@RequestParam String customerNo) {
        Customer c = customerService.byCustomerNo(customerNo);
        return Result.ok(c == null ? null : customerService.toDto(c));
    }

    @GetMapping("/customers/{id}/risk-level")
    public Result<String> riskLevel(@PathVariable Long id) {
        return Result.ok(riskService.validLevel(id));
    }

    @PostMapping("/otp/send")
    public Result<Void> sendOtp(@RequestParam String scene, @RequestParam String target) {
        otpService.send(scene, target);
        return Result.ok();
    }

    @PostMapping("/otp/verify")
    public Result<Boolean> verifyOtp(@RequestParam String scene, @RequestParam String target,
                                     @RequestParam String code) {
        return Result.ok(otpService.verify(scene, target, code));
    }

    @PostMapping("/customers/{id}/mobile/verify")
    public Result<Boolean> verifyMobile(@PathVariable Long id, @RequestParam String mobile) {
        Customer c = customerService.requireEntity(id);
        return Result.ok(c.getMobileHash().equals(sha256(mobile)));
    }

    private String sha256(String v) {
        try {
            return java.util.HexFormat.of().formatHex(
                    java.security.MessageDigest.getInstance("SHA-256").digest(v.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    @PostMapping("/customers/{id}/otp/send")
    public Result<Void> customerOtp(@PathVariable Long id, @RequestParam String scene) {
        Customer c = customerService.requireEntity(id);
        otpService.send(scene, c.getMobileHash());
        return Result.ok();
    }

    @PostMapping("/customers/{id}/otp/verify")
    public Result<Boolean> customerOtpVerify(@PathVariable Long id, @RequestParam String scene,
                                             @RequestParam String code) {
        Customer c = customerService.requireEntity(id);
        return Result.ok(otpService.verify(scene, c.getMobileHash(), code));
    }

    @PostMapping("/customers/{id}/otp/latest")
    public Result<String> customerOtpLatest(@PathVariable Long id, @RequestParam String scene) {
        Customer c = customerService.requireEntity(id);
        return Result.ok(otpService.latest(scene, c.getMobileHash()));
    }

    /** 网银"查看验证码"（本人手机号由网银侧校验归属后传入） */
    @PostMapping("/otp/latest")
    public Result<String> latestOtp(@RequestParam String scene, @RequestParam String target) {
        return Result.ok(otpService.latest(scene, target));
    }

    public record CustomerRegisterCmd(Long customerId, String loginName, String password,
                                      String realName, String mobileMask) {
    }

    /** 网银自助注册：创建 CUSTOMER 登录用户（docs/design/05 §3.1） */
    @PostMapping("/users/customer-register")
    public Result<Long> registerCustomerUser(@RequestBody CustomerRegisterCmd cmd) {
        Customer c = customerService.requireEntity(cmd.customerId());
        return Result.ok(adminService.createCustomerUser(cmd.customerId(), cmd.loginName(), cmd.password(),
                c.getCustomerName(), c.getMobileMask()).getId());
    }
}
