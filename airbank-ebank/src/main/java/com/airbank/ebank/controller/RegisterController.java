package com.airbank.ebank.controller;

import com.airbank.common.api.Result;
import com.airbank.ebank.model.RegisterCheckCmd;
import com.airbank.ebank.model.RegisterCheckVO;
import com.airbank.ebank.model.RegisterCmd;
import com.airbank.ebank.service.RegisterService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * 网银自助注册（未登录态，安全白名单 /register/**）。
 */
@RestController
@RequiredArgsConstructor
public class RegisterController {

    private final RegisterService registerService;

    @PostMapping("/register/check")
    public Result<RegisterCheckVO> check(@Valid @RequestBody RegisterCheckCmd cmd) {
        return Result.ok(registerService.check(cmd));
    }

    @PostMapping("/register")
    public Result<Boolean> register(@Valid @RequestBody RegisterCmd cmd) {
        return Result.ok(registerService.register(cmd));
    }

    /** 培训环境特性：查看注册验证码（未登录态） */
    @PostMapping("/register/otp-latest")
    public Result<String> otpLatest(@RequestBody java.util.Map<String, String> body) {
        return Result.ok(registerService.latestOtp(body.get("customerNo")));
    }
}
