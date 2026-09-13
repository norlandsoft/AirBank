package com.airbank.loan.entity;

import com.airbank.common.db.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 借据/贷款台账（t_loan_account，docs/design/13 §3）。
 * 状态机：REPAYING（还款中）→ SETTLED（已结清）。
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("t_loan_account")
public class LoanAccount extends BaseEntity {

    public static final String ST_REPAYING = "REPAYING";
    public static final String ST_SETTLED = "SETTLED";

    private Long id;
    private String loanNo;
    private String applyNo;
    private Long customerId;
    private String productCode;
    private String productName;
    /** 放款本金（分） */
    private Long principal;
    /** 执行年化利率（小数） */
    private BigDecimal annualRate;
    private Integer termMonths;
    private String repayMethod;
    private String acctNo;
    private String disburseTxnNo;
    private LocalDate disburseDate;
    private Long remainPrincipal;
    private Long paidPrincipal;
    private Long paidInterest;
    private String status;
    private String channel;
    private String operator;
}
