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
    User u = service.userLogin(user);
    if (u == null) {
      return ApiResponse.error();
    }
    if (u.getLoginStatus().equals(User.LOGGED_IN)) {
      return ApiResponse.success(u);
    }
    return ApiResponse.error();
  }

  @PostMapping("/current")
  public ApiResponse currentUser() {
    return ApiResponse.success();
  }

  @PostMapping("/info")
  public ApiResponse getUserInfo(@RequestBody User user) {
    User u = service.getUserById(user.getId());
    if (u == null) {
      return ApiResponse.error();
    }
    return ApiResponse.success(u);
  }

}
