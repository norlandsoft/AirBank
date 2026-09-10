package com.airbank.ebank.entity;

import com.airbank.ebank.config.JsonbTypeHandler;
import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * 电子回单（t_e_receipt）。content 为 JSONB，经 JsonbTypeHandler 与 Map 互转。
 */
@Data
@TableName(value = "t_e_receipt", autoResultMap = true)
public class EReceipt {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 防伪编号："RCP" + 12 位随机数字 */
    private String receiptNo;

    private Long customerId;

    private String bizType;

    private String bizNo;

    @TableField(typeHandler = JsonbTypeHandler.class)
    private Map<String, Object> content;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}
