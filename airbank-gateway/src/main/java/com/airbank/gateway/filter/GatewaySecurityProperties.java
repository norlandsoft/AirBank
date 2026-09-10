package com.airbank.gateway.filter;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;

@Data
@ConfigurationProperties(prefix = "airbank.gateway.security")
public class GatewaySecurityProperties {

    private String jwtSecret = "airbank-dev-jwt-secret-0001-airbank-dev-jwt-secret-0001";

    private List<String> whitelist = List.of(
            "/api/*/actuator/**", "/api/*/v3/api-docs/**", "/api/*/swagger-ui/**", "/api/*/swagger-ui.html",
            "/api/uam/auth/login", "/api/uam/auth/captcha", "/api/uam/internal/**",
            "/api/ebank/auth/login", "/api/ebank/auth/captcha", "/api/ebank/register/**",
            "/api/core/internal/**", "/api/wealth/internal/**", "/api/counter/internal/**", "/api/ebank/internal/**");
}
