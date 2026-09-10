package com.airbank.wealth.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 每日收益计提（t_income_record，docs/design/06 §4）。
 * 幂等键 (position_id, batch_date) 唯一；只计提不付账，付账发生在赎回/到期清算。
 */
@Data
@TableName("t_income_record")
public class IncomeRecord {

    private Long id;
    private Long positionId;
    private LocalDate batchDate;
    /** 当日计提收益（分） */
    private Long income;
    /** 计提时年化利率 */
    private BigDecimal rate;
}
