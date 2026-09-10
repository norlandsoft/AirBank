package com.airbank.counter.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 复核授权审计（t_review_log）。action ∈ APPROVE / REJECT，双人复核独立留痕。
 */
@Data
@TableName("t_review_log")
public class ReviewLog {

    public static final String ACTION_APPROVE = "APPROVE";
    public static final String ACTION_REJECT = "REJECT";

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long ctTxnId;

    private String action;

    private String actor;

    private String comment;

    private LocalDateTime createdAt;
}
