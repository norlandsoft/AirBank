package com.airbank.uam;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

@EnableDiscoveryClient
@MapperScan("com.airbank.uam.mapper")
@SpringBootApplication
public class UamApplication {

    public static void main(String[] args) {
        SpringApplication.run(UamApplication.class, args);
    }
}
