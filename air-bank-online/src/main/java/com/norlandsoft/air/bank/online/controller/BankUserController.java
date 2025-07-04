package com.norlandsoft.air.bank.online.controller;

import com.norlandsoft.air.bank.entity.ApiResponse;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Created by ChaiMingXu, on 2025/7/3
 */
@RestController
@RequestMapping("/api/user")
public class BankUserController {


  @PostMapping("/info")
  public ApiResponse getUserInfo() {
    return ApiResponse.success();
  }

}
