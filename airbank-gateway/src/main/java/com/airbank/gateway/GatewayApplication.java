package com.airbank.gateway;

import com.airbank.gateway.filter.GatewaySecurityProperties;
import com.airbank.gateway.filter.JwtGlobalFilter;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.context.annotation.Bean;

@EnableDiscoveryClient
@EnableConfigurationProperties(GatewaySecurityProperties.class)
@SpringBootApplication
public class GatewayApplication {

    public static void main(String[] args) {
        SpringApplication.run(GatewayApplication.class, args);
    }

    @Bean
    public JwtGlobalFilter jwtGlobalFilter(GatewaySecurityProperties props) {
        return new JwtGlobalFilter(props);
    }
}
