package com.norlandsoft.air.bank.online;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.cloud.openfeign.EnableFeignClients;

/**
 * Created by ChaiMingXu, on 2025/7/3
 */
@SpringBootApplication
@EnableDiscoveryClient
@EnableFeignClients
@MapperScan({"com.norlandsoft.air.bank.online.dao"})
public class OnlineBankingApp {
  public static void main(String[] args) {
    SpringApplication.run(OnlineBankingApp.class, args);
  }
}
