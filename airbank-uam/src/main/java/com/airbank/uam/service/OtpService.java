package com.airbank.uam.service;

import com.airbank.common.exception.BizException;
import com.airbank.common.exception.ErrorCodes;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Duration;

/**
 * 短信 OTP（模拟）：验证码存 Redis 5 分钟，支持"查看验证码"（培训环境特性，ADR-8）。
 */
@Service
@RequiredArgsConstructor
public class OtpService {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Duration TTL = Duration.ofMinutes(5);

    private final StringRedisTemplate redis;

    public void send(String scene, String target) {
        String code = String.format("%06d", RANDOM.nextInt(1_000_000));
        redis.opsForValue().set("otp:" + scene + ":" + target, code, TTL);
    }

    /** 校验并消费；通过返回 true，失败/过期返回 false */
    public boolean verify(String scene, String target, String code) {
        String key = "otp:" + scene + ":" + target;
        String expected = redis.opsForValue().get(key);
        if (expected != null && expected.equals(code == null ? "" : code.trim())) {
            redis.delete(key);
            return true;
        }
        return false;
    }

    /** 供渠道"查看验证码"（培训环境专用，docs/design/05 §3.1） */
    public String latest(String scene, String target) {
        return redis.opsForValue().get("otp:" + scene + ":" + target);
    }

    public void verifyOrThrow(String scene, String target, String code) {
        if (!verify(scene, target, code)) {
            throw BizException.of(ErrorCodes.OTP_INVALID, "短信验证码错误或已过期");
        }
    }
}
