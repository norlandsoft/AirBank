package com.airbank.common.security;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;

@Data
@ConfigurationProperties(prefix = "airbank.security")
public class SecurityProperties {

    /** 是否启用认证过滤器（本地调试可关闭） */
    private boolean enabled = true;
    /** JWT 签名密钥（≥32 字节），与 uam 签发端一致 */
    private String jwtSecret = "airbank-dev-jwt-secret-0001-airbank-dev-jwt-secret-0001";
    /** 敏感字段 AES-256-GCM 密钥（32 字节），仅培训环境默认值 */
    private String aesKey = "airbank-dev-aes-key-0001-32bytes!!";
    /** token 有效期（分钟） */
    private int jwtExpireMinutes = 120;
    /** 免认证路径（相对 context-path 的 Ant 风格）；/internal/** 为服务间契约，仅内网可达 */
    private List<String> excludePaths = List.of(
            "/actuator/**", "/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html", "/error", "/internal/**");
}
