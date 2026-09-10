package com.airbank.counter.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDate;

/**
 * 柜员尾箱（t_cash_box）。UNIQUE(teller_no, shift_date)，begin_balance 为上日结转。
 */
@Data
@TableName("t_cash_box")
public class CashBox {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String tellerNo;

    private LocalDate shiftDate;

    private Long beginBalance;

    private Long cashIn;

    private Long cashOut;

    private Long balance;
}
