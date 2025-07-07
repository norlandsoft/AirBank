package com.norlandsoft.air.bank.entity;

import lombok.Data;

/**
 * Created by ChaiMingXu, on 2025/5/7
 */
@Data
public class Customer {
  private String id;
  private String name;
  private String gender; // M - 男， F - 女
  private String phone;
  private String address;
  private String email;

  private String cnid; // 身份证号码
}
