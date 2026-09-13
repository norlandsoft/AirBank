package com.airbank.loan.entity;

import com.airbank.common.db.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;

/**
 * 贷款申请（t_loan_apply，docs/design/13 §3）。
 * 状态机：SUBMITTED → ID_CHECKED → CREDIT_CHECKED → APPROVED / REJECTED → DISBURSED / DISBURSE_FAILED。
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("t_loan_apply")
public class LoanApply extends BaseEntity {

    public static final String ST_SUBMITTED = "SUBMITTED";
    public static final String ST_ID_CHECKED = "ID_CHECKED";
    public static final String ST_CREDIT_CHECKED = "CREDIT_CHECKED";
    public static final String ST_APPROVED = "APPROVED";
    public static final String ST_REJECTED = "REJECTED";
    public static final String ST_DISBURSED = "DISBURSED";
    public static final String ST_DISBURSE_FAILED = "DISBURSE_FAILED";

    private Long id;
    private String applyNo;
    private String requestNo;
    private Long customerId;
    private String productCode;
    private Long amount;
    private Integer termMonths;
    private String purpose;
    /** 放款/还款账户（本人活期） */
    private String acctNo;
    private String status;
    /** 联网核查结果：PASS / MISMATCH */
    private String idCheckResult;
    /** 征信分（mock） */
    private Integer creditScore;
    /** 批准金额（分，部分批准时低于申请金额） */
    private Long approveAmount;
    /** 批准利率（年化小数，含风险加点） */
    private BigDecimal approveRate;
    private String rejectReason;
    /** 放款成功后的借据号 */
    private String loanNo;
    private String channel;
    private String operator;
}
