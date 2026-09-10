package com.airbank.ebank.model;

import jakarta.validation.constraints.NotBlank;

/**
 * 收款人名册新增请求。
 */
public record BeneficiaryCmd(
        @NotBlank(message = "收款人户名不能为空") String payeeName,
        @NotBlank(message = "收款账号不能为空") String payeeAcct,
        String bankName,
        String alias
) {
}
