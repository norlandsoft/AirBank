package com.airbank.loan.entity;

import com.airbank.common.db.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 还款计划（t_loan_schedule）：等额本息逐期本金/利息。
 * 状态：PENDING 待还 / PAID 已还。
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("t_loan_schedule")
public class LoanSchedule extends BaseEntity {

    public static final String ST_PENDING = "PENDING";
    public static final String ST_PAID = "PAID";

    private Long id;
    private Long loanId;
    private String loanNo;
    private Integer periodNo;
    private LocalDate dueDate;
    private Long principal;
    private Long interest;
    private Long total;
    private String status;
    private LocalDateTime paidAt;
}
