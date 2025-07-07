package com.norlandsoft.air.bank.entity;

import lombok.Data;

/**
 * 网银用户账号
 * Created by ChaiMingXu, on 2025/5/7
 */
@Data
public class User {

  public static final String LOGGED_IN = "logged_in";
  public static final String LOGGED_OUT = "logged_out";

  private String id;
  private String name;
  private String password;

  private String customerId;

  private String loginStatus = LOGGED_OUT;
  private String token;
}
