package com.airbank.counter.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 尾箱现金流水（t_cash_box_flow）。direction ∈ IN / OUT。
 */
@Data
@TableName("t_cash_box_flow")
public class CashBoxFlow {

    public static final String DIR_IN = "IN";
    public static final String DIR_OUT = "OUT";

    @TableId(type = IdType.AUTO)
    private Long id;

    private String tellerNo;

    private LocalDate shiftDate;

    private String direction;

    private Long amount;

    private String bizType;

    private Long ctTxnId;

    private Long balanceAfter;

    private LocalDateTime createdAt;
}
