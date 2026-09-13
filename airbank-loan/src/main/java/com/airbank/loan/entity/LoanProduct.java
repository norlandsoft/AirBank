package com.airbank.loan.entity;

import com.airbank.common.db.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;

/**
 * 贷款产品（t_loan_product，docs/design/13 §3）。
 * 状态：ON_SALE 在售 / OFF_SALE 停售。
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("t_loan_product")
public class LoanProduct extends BaseEntity {

    public static final String ST_ON_SALE = "ON_SALE";
    public static final String ST_OFF_SALE = "OFF_SALE";

    public static final String REPAY_EQUAL_INSTALLMENT = "EQUAL_INSTALLMENT";

    private Long id;
    private String productCode;
    private String productName;
    private String description;
    /** 起借金额（分） */
    private Long minAmount;
    /** 单笔上限（分） */
    private Long maxAmount;
    /** 可选期限（月），逗号分隔 */
    private String termOptions;
    /** 基准年化利率（小数，如 0.0720） */
    private BigDecimal annualRate;
    /** 还款方式：EQUAL_INSTALLMENT 等额本息 */
    private String repayMethod;
    /** 准入征信分（mock 审批线） */
    private Integer minScore;
    private String status;
}
