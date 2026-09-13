package com.airbank.loan.entity;

import com.airbank.common.db.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 还款记录（t_loan_repayment）。金额单位：分。
 * 状态：SUCCESS / FAILED（核心扣款明确拒绝）。
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("t_loan_repayment")
public class LoanRepayment extends BaseEntity {

    public static final String MODE_INSTALLMENT = "INSTALLMENT";
    public static final String MODE_SETTLE = "SETTLE";

    public static final String ST_SUCCESS = "SUCCESS";
    public static final String ST_FAILED = "FAILED";

    private Long id;
    private String repayNo;
    private String requestNo;
    private Long loanId;
    private String loanNo;
    private String repayMode;
    /** 结清的期次（提前结清为 null） */
    private Integer periodNo;
    private Long amount;
    private Long principalPart;
    private Long interestPart;
    private String principalTxnNo;
    private String interestTxnNo;
    private String status;
    private String failReason;
    private String channel;
    private String operator;
}
