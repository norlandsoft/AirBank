package com.airbank.ebank.controller;

import com.airbank.common.api.Result;
import com.airbank.ebank.model.OtpCmd;
import com.airbank.ebank.service.OtpService;
import com.airbank.ebank.service.OwnerGuard;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * 网银 OTP：向本人预留手机号发送（模拟短信落消息中心）+ 培训环境"查看验证码"（ADR-8）。
 */
@RestController
@RequiredArgsConstructor
public class EbankOtpController {

    private final OtpService otpService;

    @PostMapping("/otp/send")
    public Result<Void> send(@Valid @RequestBody OtpCmd cmd) {
        otpService.send(OwnerGuard.requireCustomerId(), cmd.scene());
        return Result.ok();
    }

    @PostMapping("/otp/latest")
    public Result<String> latest(@Valid @RequestBody OtpCmd cmd) {
        return Result.ok(otpService.latest(OwnerGuard.requireCustomerId(), cmd.scene()));
    }
}
