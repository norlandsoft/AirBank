package com.norlandsoft.air.bank.online;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

/**
 * Created by ChaiMingXu, on 2025/7/3
 */
@SpringBootApplication
@EnableDiscoveryClient
public class OnlineBankingApp {
  public static void main(String[] args) {
    SpringApplication.run(OnlineBankingApp.class, args);
  }
}
