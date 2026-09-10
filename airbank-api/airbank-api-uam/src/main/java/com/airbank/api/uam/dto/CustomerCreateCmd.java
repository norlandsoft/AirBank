package com.airbank.api.uam.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * 客户建立命令（柜面受理）。
 */
public record CustomerCreateCmd(
        @NotBlank(message = "客户姓名不能为空") @Size(max = 64) String customerName,
        @NotBlank(message = "证件类型不能为空") String idType,
        @NotBlank(message = "证件号码不能为空") @Pattern(regexp = "^[0-9Xx]{6,20}$", message = "证件号码格式不正确") String idNo,
        @NotBlank(message = "手机号不能为空") @Pattern(regexp = "^1\\d{10}$", message = "手机号格式不正确") String mobile,
        String gender,
        String occupation,
        String address
) {
}
