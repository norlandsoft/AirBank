package com.airbank.uam.service;

import com.airbank.common.exception.BizException;
import com.airbank.common.exception.ErrorCodes;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Duration;
import java.util.Arrays;
import java.util.List;
import java.util.random.RandomGenerator;

/**
 * 图形验证码：SVG 自绘（无外部依赖），Redis 存储 5 分钟（docs/design/05 §1.2）。
 */
@Service
@RequiredArgsConstructor
public class CaptchaService {

    private static final String CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final StringRedisTemplate redis;

    public record Captcha(String uuid, String svg) {
    }

    public Captcha generate() {
        StringBuilder code = new StringBuilder();
        RandomGenerator rg = RANDOM;
        for (int i = 0; i < 4; i++) {
            code.append(CHARS.charAt(rg.nextInt(CHARS.length())));
        }
        String uuid = java.util.UUID.randomUUID().toString().replace("-", "");
        redis.opsForValue().set("captcha:" + uuid, code.toString(), Duration.ofMinutes(5));
        return new Captcha(uuid, render(code.toString()));
    }

    public void verify(String uuid, String input) {
        if (uuid == null || input == null) {
            throw BizException.of(ErrorCodes.CAPTCHA_INVALID, "验证码错误或已过期");
        }
        String key = "captcha:" + uuid;
        String expected = redis.opsForValue().get(key);
        redis.delete(key);
        if (expected == null || !expected.equalsIgnoreCase(input.trim())) {
            throw BizException.of(ErrorCodes.CAPTCHA_INVALID, "验证码错误或已过期");
        }
    }

    private String render(String code) {
        StringBuilder sb = new StringBuilder();
        sb.append("<svg xmlns='http://www.w3.org/2000/svg' width='110' height='40' viewBox='0 0 110 40'>");
        sb.append("<rect width='110' height='40' fill='#f0f4fa'/>");
        for (int i = 0; i < 3; i++) {
            int x1 = RANDOM.nextInt(100), y1 = RANDOM.nextInt(35), x2 = RANDOM.nextInt(100), y2 = RANDOM.nextInt(35);
            sb.append("<line x1='").append(x1).append("' y1='").append(y1).append("' x2='").append(x2)
                    .append("' y2='").append(y2).append("' stroke='#9db4d0' stroke-width='1'/>");
        }
        List<String> colors = Arrays.asList("#1B4D92", "#0E8A8A", "#8A5A0E", "#4A1B92");
        for (int i = 0; i < code.length(); i++) {
            int x = 12 + i * 24 + RANDOM.nextInt(6);
            int y = 26 + RANDOM.nextInt(8);
            int rot = RANDOM.nextInt(30) - 15;
            sb.append("<text x='").append(x).append("' y='").append(y).append("' font-size='24' font-family='monospace' fill='")
                    .append(colors.get(RANDOM.nextInt(colors.size()))).append("' transform='rotate(").append(rot)
                    .append(" ").append(x).append(" ").append(y).append(")'>").append(code.charAt(i)).append("</text>");
        }
        sb.append("</svg>");
        return sb.toString();
    }
}
