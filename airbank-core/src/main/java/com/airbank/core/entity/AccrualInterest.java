package com.airbank.core.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@TableName("t_accrual_interest")
public class AccrualInterest {

    @TableId(type = IdType.AUTO)
    private Long id;
    private String acctNo;
    private LocalDate batchDate;
    private Long accrual;
    private BigDecimal rate;
}
