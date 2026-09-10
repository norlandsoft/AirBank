package com.airbank.wealth.entity;

import com.airbank.common.db.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 申赎订单（t_wealth_order，docs/design/06 §4）。
 * 订单状态机：PAYING→PAY_SUCCESS/PAY_FAILED→CONFIRMED→SETTLED（REDEEMING 为赎回在途）。
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("t_wealth_order")
public class WealthOrder extends BaseEntity {

    public static final String TYPE_PURCHASE = "PURCHASE";
    public static final String TYPE_REDEEM = "REDEEM";

    public static final String ST_PAYING = "PAYING";
    public static final String ST_PAY_SUCCESS = "PAY_SUCCESS";
    public static final String ST_PAY_FAILED = "PAY_FAILED";
    public static final String ST_CONFIRMED = "CONFIRMED";
    public static final String ST_REDEEMING = "REDEEMING";
    public static final String ST_SETTLED = "SETTLED";

    private Long id;
    private String orderNo;
    /** 幂等键，全链路传递（唯一索引兜底） */
    private String requestNo;
    private String orderType;
    private Long productId;
    private String productCode;
    private Long customerId;
    private String acctNo;
    /** 申购金额或赎回本金（分） */
    private Long amount;
    /** 确认份额（赎回为扣减份额），DECIMAL(20,2) */
    private BigDecimal shares;
    /** 赎回支付收益（分） */
    private Long incomeAmount;
    private String status;
    private String payTxnNo;
    private String redeemTxnNo;
    private String incomeTxnNo;
    /** T+1 确认会计日期 */
    private LocalDate confirmDate;
    private String channel;
    private String operator;
    private String failReason;
}
