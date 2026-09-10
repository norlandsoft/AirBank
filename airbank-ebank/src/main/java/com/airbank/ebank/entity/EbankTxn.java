package com.airbank.ebank.entity;

import com.airbank.common.db.BaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/**
 * 网银渠道流水（t_ebank_txn，deploy/postgres/init/50-ebank-schema.sql）。
 * requestNo 全局唯一实现幂等；status: INIT → SUCCESS / FAILED。
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("t_ebank_txn")
public class EbankTxn extends BaseEntity {

    public static final String BIZ_TRANSFER = "TRANSFER";

    public static final String ST_INIT = "INIT";
    public static final String ST_SUCCESS = "SUCCESS";
    public static final String ST_FAILED = "FAILED";

    @TableId(type = IdType.AUTO)
    private Long id;

    private String requestNo;

    private String bizType;

    private Long customerId;

    private String acctNo;

    private Long amount;

    private String status;

    /** 下游核心系统流水号（txnNo） */
    private String downstreamNo;

    private LocalDateTime finishedAt;
}
