package com.norlandsoft.air.bank.online.controller;

import com.norlandsoft.air.bank.entity.ApiResponse;
import com.norlandsoft.air.bank.entity.Customer;
import com.norlandsoft.air.bank.online.service.client.CustomerClient;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Created by ChaiMingXu, on 2025/7/4
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/customer")
public class BankCustomerController {

  private final CustomerClient customerClient;

  @PostMapping("/info")
  public ApiResponse getCustomer(@RequestBody String id) {
    Customer c = customerClient.getCustomer(id);
    return ApiResponse.success(c);
  }
}
