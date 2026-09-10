package com.airbank.wealth.entity;

import com.airbank.common.db.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 理财产品（t_product，docs/design/06 §4）。
 * 状态机：DRAFT→ON_SALE→(SOLD_OUT|OFF_SALE)→RUNNING→SETTLING→CLOSED。
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("t_product")
public class Product extends BaseEntity {

    public static final String ST_DRAFT = "DRAFT";
    public static final String ST_ON_SALE = "ON_SALE";
    public static final String ST_OFF_SALE = "OFF_SALE";
    public static final String ST_SOLD_OUT = "SOLD_OUT";
    public static final String ST_RUNNING = "RUNNING";
    public static final String ST_SETTLING = "SETTLING";
    public static final String ST_CLOSED = "CLOSED";

    private Long id;
    private String productCode;
    private String productName;
    private Integer termDays;
    /** 业绩比较基准（年化，如 0.0260） */
    private BigDecimal annualRate;
    /** R1/R2/R3 */
    private String riskLevel;
    private Long minAmount;
    private Long stepAmount;
    private Long maxSingleAmount;
    private Long raiseLimit;
    private Long raisedAmount;
    private LocalDate raiseStartDate;
    private LocalDate raiseEndDate;
    /** 成立日（起息），申购订单 confirm_date 取此值 */
    private LocalDate valueDate;
    private LocalDate maturityDate;
    private String status;
    /** 赎回费率，v1 预留 = 0 */
    private BigDecimal redeemFeeRate;
}
