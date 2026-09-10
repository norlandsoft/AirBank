package com.airbank.uam.controller;

import com.airbank.common.api.Result;
import com.airbank.common.security.AuthContext;
import com.airbank.common.security.AuthUser;
import com.airbank.common.security.SecurityProperties;
import com.airbank.uam.model.LoginCmd;
import com.airbank.uam.model.LoginVO;
import com.airbank.uam.model.MenuNode;
import com.airbank.uam.service.AuthService;
import com.airbank.uam.service.CaptchaService;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final CaptchaService captchaService;
    private final SecurityProperties securityProps;

    public record CaptchaVO(String uuid, String svg) {
    }

    @GetMapping("/captcha")
    public Result<CaptchaVO> captcha() {
        CaptchaService.Captcha c = captchaService.generate();
        return Result.ok(new CaptchaVO(c.uuid(), c.svg()));
    }

    @PostMapping("/login")
    public Result<LoginVO> login(@Valid @RequestBody LoginCmd cmd, HttpServletRequest request) {
        String ip = request.getRemoteAddr();
        String ua = request.getHeader("User-Agent");
        return Result.ok(authService.login(cmd, ip, ua));
    }

    @PostMapping("/logout")
    public Result<Void> logout(HttpServletRequest request) {
        AuthUser user = AuthContext.require();
        String auth = request.getHeader("Authorization");
        long remain = 0;
        try {
            SecretKey key = Keys.hmacShaKeyFor(securityProps.getJwtSecret().getBytes(StandardCharsets.UTF_8));
            Date exp = Jwts.parser().verifyWith(key).build().parseSignedClaims(auth.substring(7)).getPayload().getExpiration();
            remain = Math.max(0, (exp.getTime() - System.currentTimeMillis()) / 1000);
        } catch (Exception ignore) {
            // token 已无效则无需拉黑
        }
        authService.logout(user.jti(), remain);
        return Result.ok();
    }

    @GetMapping("/menus")
    public Result<List<MenuNode>> menus() {
        return Result.ok(authService.menus(AuthContext.require().userType()));
    }
}
