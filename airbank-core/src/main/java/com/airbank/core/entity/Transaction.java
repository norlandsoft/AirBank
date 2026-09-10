package com.airbank.core.entity;

import com.airbank.common.db.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDate;
import java.time.LocalDateTime;

/** 业务流水（docs/design/03 §2.3） */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("t_transaction")
public class Transaction extends BaseEntity {

    public static final String ST_SUCCESS = "SUCCESS";
    public static final String ST_FAILED = "FAILED";
    public static final String ST_REVERSED = "REVERSED";

    private Long id;
    private String txnNo;
    private String requestNo;
    private String txnType;
    private Long amount;
    private String fromAcct;
    private String toAcct;
    private Long fromBalanceAfter;
    private Long toBalanceAfter;
    private String channel;
    private String operator;
    private String branchNo;
    private String summary;
    private LocalDate batchDate;
    private String status;
    private String reverseOf;
    private LocalDateTime finishedAt;
}
