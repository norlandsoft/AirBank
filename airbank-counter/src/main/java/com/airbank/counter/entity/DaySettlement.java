package com.airbank.counter.entity;

import com.airbank.counter.mapper.JsonbTypeHandler;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDate;
import java.util.Map;

/**
 * 柜员日结单（t_day_settlement）。UNIQUE(teller_no, shift_date)；balanced 为 false 不允许签退（5007）。
 */
@Data
@TableName(value = "t_day_settlement", autoResultMap = true)
public class DaySettlement {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String tellerNo;

    private LocalDate shiftDate;

    /** 当日 POSTED 笔数 */
    private Integer txnCount;

    private Long cashIn;

    private Long cashOut;

    private Long debitTotal;

    private Long creditTotal;

    private Long boxBegin;

    private Long boxEnd;

    private Boolean balanced;

    @TableField(typeHandler = JsonbTypeHandler.class)
    private Map<String, Object> report;

    private String reviewedBy;
}
