package com.norlandsoft.air.bank.core;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

/**
 * Created by ChaiMingXu, on 2025/5/7
 */
@SpringBootApplication
@EnableDiscoveryClient
public class CoreBankingApp {
  public static void main(String[] args) {
    SpringApplication.run(CoreBankingApp.class, args);
  }
}
