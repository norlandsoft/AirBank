package com.norlandsoft.air.bank.entity;

import lombok.Data;

/**
 * 网银用户账号
 * Created by ChaiMingXu, on 2025/5/7
 */
@Data
public class User {
  private String id;
  private String name;
  private String password;
  private String address;
  private String email;
  private String phone;
}
