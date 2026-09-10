package com.airbank.ebank.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 客户网银转账限额（t_transfer_limit）。表无 created 审计列，不继承 BaseEntity。
 */
@Data
@TableName("t_transfer_limit")
public class TransferLimit {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long customerId;

    private Long singleLimit;

    private Long dailyLimit;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private String updatedBy;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
