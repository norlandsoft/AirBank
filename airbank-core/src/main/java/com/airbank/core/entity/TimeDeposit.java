package com.airbank.core.entity;

import com.airbank.common.db.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("t_time_deposit")
public class TimeDeposit extends BaseEntity {

    public static final String ST_HOLDING = "HOLDING";
    public static final String ST_MATURED = "MATURED_PAID";
    public static final String ST_BROKEN = "BROKEN_EARLY";

    private Long id;
    private String depositNo;
    private String acctNo;
    private Integer termMonths;
    private BigDecimal annualRate;
    private Long amount;
    private LocalDate valueDate;
    private LocalDate maturityDate;
    private Long interest;
    private String status;
    private LocalDateTime paidAt;
}
