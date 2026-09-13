package com.airbank.loan.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 外联系统查询留痕（t_ext_check_log，docs/design/13 §6）：
 * 联网核查（ID_VERIFY）与征信查询（CREDIT_REPORT）的请求/应答全文，mock 实现同样落痕，便于演示与审计。
 */
@Data
@TableName("t_ext_check_log")
public class ExtCheckLog {

    public static final String TYPE_ID_VERIFY = "ID_VERIFY";
    public static final String TYPE_CREDIT_REPORT = "CREDIT_REPORT";

    @TableId(type = IdType.AUTO)
    private Long id;
    /** 关联业务号（申请号） */
    private String bizNo;
    private String checkType;
    private String requestText;
    private String responseText;
    /** PASS / MISMATCH / HIT / CLEAR */
    private String result;
    private LocalDateTime createdAt;
}
