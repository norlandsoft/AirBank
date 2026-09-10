package com.airbank.counter.entity;

import com.airbank.common.db.BaseEntity;
import com.airbank.counter.mapper.JsonbTypeHandler;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Map;

/**
 * 柜面业务申请单（t_counter_txn，docs/design/05 §2.2 统一受理模型）。
 *
 * 状态机：PENDING_REVIEW → EXECUTING → POSTED / FAILED；PENDING_REVIEW → REJECTED；FAILED →(retry) EXECUTING。
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName(value = "t_counter_txn", autoResultMap = true)
public class CounterTxn extends BaseEntity {

    public static final String ST_PENDING_REVIEW = "PENDING_REVIEW";
    public static final String ST_EXECUTING = "EXECUTING";
    public static final String ST_POSTED = "POSTED";
    public static final String ST_FAILED = "FAILED";
    public static final String ST_REJECTED = "REJECTED";

    /** 业务类型（授权矩阵见 docs/design/05 §2.2） */
    public static final String BIZ_ACCOUNT_OPEN = "ACCOUNT_OPEN";
    public static final String BIZ_CASH_DEPOSIT = "CASH_DEPOSIT";
    public static final String BIZ_CASH_WITHDRAW = "CASH_WITHDRAW";
    public static final String BIZ_INNER_TRANSFER = "INNER_TRANSFER";
    public static final String BIZ_TIME_DEPOSIT_IN = "TIME_DEPOSIT_IN";
    public static final String BIZ_TIME_DEPOSIT_BREAK = "TIME_DEPOSIT_BREAK";
    public static final String BIZ_WEALTH_SUBSCRIBE = "WEALTH_SUBSCRIBE";
    public static final String BIZ_WEALTH_REDEEM = "WEALTH_REDEEM";
    public static final String BIZ_ACCOUNT_FREEZE = "ACCOUNT_FREEZE";
    public static final String BIZ_ACCOUNT_UNFREEZE = "ACCOUNT_UNFREEZE";
    public static final String BIZ_ACCOUNT_CLOSE = "ACCOUNT_CLOSE";
    public static final String BIZ_ACCOUNT_STOP_PAYMENT = "ACCOUNT_STOP_PAYMENT";
    public static final String BIZ_ACCOUNT_RESUME_PAYMENT = "ACCOUNT_RESUME_PAYMENT";
    public static final String BIZ_REVERSE = "REVERSE";

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 申请单号：CT + yyyyMMdd + 8 位序列（seq_ct） */
    private String ctNo;

    private String bizType;

    @TableField(typeHandler = JsonbTypeHandler.class)
    private Map<String, Object> payload;

    /** 金额（分），非金额类业务为 0 */
    private Long amount;

    private String status;

    private String tellerNo;

    private String branchNo;

    private LocalDate shiftDate;

    private String reviewerNo;

    private LocalDateTime reviewedAt;

    private String reviewComment;

    /** 幂等键，全链路透传下游 */
    private String requestNo;

    @TableField(typeHandler = JsonbTypeHandler.class)
    private Map<String, Object> result;

    private String failReason;

    /** 被 REVERSE 冲正的原申请单 id */
    private Long reversedBy;
}
