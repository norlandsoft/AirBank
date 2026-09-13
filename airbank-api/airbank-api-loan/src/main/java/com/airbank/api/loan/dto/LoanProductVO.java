package com.airbank.api.loan.dto;

import java.math.BigDecimal;

/**
 * 贷款产品视图。金额单位：分；annualRate 为年化小数（如 0.0720 = 7.2%）。
 */
public record LoanProductVO(
        String productCode,
        String productName,
        String description,
        Long minAmount,
        Long maxAmount,
        /** 可选期限（月），逗号分隔，如 "3,6,12,24,36" */
        String termOptions,
        BigDecimal annualRate,
        /** 还款方式：EQUAL_INSTALLMENT 等额本息 */
        String repayMethod,
        /** 准入征信分（mock 审批线） */
        Integer minScore,
        String status
) {
}
