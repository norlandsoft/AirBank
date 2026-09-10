package com.airbank.ebank.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 消息中心（t_message）。msg_type: OTP / TXN / SYS；is_read 已读标记。
 */
@Data
@TableName("t_message")
public class Message {

    public static final String TYPE_OTP = "OTP";
    public static final String TYPE_TXN = "TXN";
    public static final String TYPE_SYS = "SYS";

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long customerId;

    private String msgType;

    private String title;

    private String content;

    private Boolean isRead;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}
