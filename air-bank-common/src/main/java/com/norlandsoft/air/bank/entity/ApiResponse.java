package com.norlandsoft.air.bank.entity;

import lombok.Data;

/**
 * Created by ChaiMingXu, on 2025/7/4
 */
@Data
public class ApiResponse {
  private boolean success;
  private String code;
  private String message;
  private Object data;

  public static ApiResponse success() {
    ApiResponse resp = new ApiResponse();
    resp.setSuccess(true);
    return resp;
  }

  public static ApiResponse success(Object data) {
    ApiResponse resp = new ApiResponse();
    resp.setSuccess(true);
    resp.setData(data);
    return resp;
  }
}
