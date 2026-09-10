package com.airbank.uam.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record UserCreateCmd(
        @NotBlank @Pattern(regexp = "^[0-9]{6}$", message = "工号须为 6 位数字") String tellerNo,
        @NotBlank @Size(min = 2, max = 32) String realName,
        @NotBlank @Pattern(regexp = "^[0-9]{3}$", message = "机构号须为 3 位数字") String branchNo,
        @NotBlank String roleCode,
        @NotBlank @Size(min = 8, max = 20, message = "密码须为 8~20 位") @Pattern(regexp = "^(?=.*[A-Za-z])(?=.*\\d).+$", message = "密码须同时包含字母和数字") String password
) {
}
