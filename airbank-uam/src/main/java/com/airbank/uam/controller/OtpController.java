package com.airbank.uam.controller;

import com.airbank.common.api.Result;
import com.airbank.common.exception.BizException;
import com.airbank.common.exception.ErrorCodes;
import com.airbank.common.security.AuthContext;
import com.airbank.common.security.AuthUser;
import com.airbank.uam.entity.Customer;
import com.airbank.uam.service.CustomerService;
import com.airbank.uam.service.OtpService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 面向用户的 OTP：网银客户向本人预留手机号发送（docs/design/05 §3.2）。
 */
@RestController
@RequestMapping("/otp")
@RequiredArgsConstructor
public class OtpController {

    private final OtpService otpService;
    private final CustomerService customerService;

    public record OtpSendCmd(String scene) {
    }

    @PostMapping("/send")
    public Result<Void> send(@RequestBody OtpSendCmd cmd) {
        AuthUser user = AuthContext.require();
        if (user.customerId() == null) {
            throw BizException.of(ErrorCodes.UNAUTHORIZED, "仅网银客户可发送验证码");
        }
        Customer c = customerService.requireEntity(user.customerId());
        otpService.send(cmd.scene(), c.getMobileHash());
        return Result.ok();
    }

    /** 培训环境特性：查看本人最新验证码（docs/design/05 §3.1 消息中心"查看验证码"） */
    @PostMapping("/latest")
    public Result<String> latest(@RequestBody OtpSendCmd cmd) {
        AuthUser user = AuthContext.require();
        if (user.customerId() == null) {
            throw BizException.of(ErrorCodes.UNAUTHORIZED, "仅网银客户可查看验证码");
        }
        Customer c = customerService.requireEntity(user.customerId());
        return Result.ok(otpService.latest(cmd.scene(), c.getMobileHash()));
    }
}
