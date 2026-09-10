package com.airbank.wealth.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 持仓（t_position，docs/design/06 §4）。客户 × 产品唯一；1.00 元 = 1.00 份。
 * 注意：该表无审计字段，不继承 BaseEntity。
 */
@Data
@TableName("t_position")
public class Position {

    private Long id;
    private Long customerId;
    private Long productId;
    private String productCode;
    private String acctNo;
    /** 总份额 DECIMAL(20,2) */
    private BigDecimal totalShares;
    /** 赎回在途冻结份额 */
    private BigDecimal frozenShares;
    /** 持仓本金（分） */
    private Long costAmount;
    /** 计提未付收益（分） */
    private Long accruingIncome;
    /** 已付收益（分） */
    private Long paidIncome;
    private LocalDate firstBuyDate;
}
