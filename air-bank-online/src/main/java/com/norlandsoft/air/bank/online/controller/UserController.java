package com.norlandsoft.air.bank.online.controller;

import com.norlandsoft.air.bank.entity.ApiResponse;
import com.norlandsoft.air.bank.entity.User;
import com.norlandsoft.air.bank.online.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Created by ChaiMingXu, on 2025/7/3
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/user")
public class UserController {

  private final UserService service;

  @PostMapping("/login")
  public ApiResponse userLogin(@RequestBody User user) {
    user.setId("chaimx");
    user.setName("Eric Chai");
    return ApiResponse.success(user);
  }

  @PostMapping("/info")
  public ApiResponse getUserInfo() {
    return ApiResponse.success();
  }

}
