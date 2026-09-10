package com.airbank.counter.entity;

import com.airbank.counter.mapper.JsonbTypeHandler;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * 业务回执（t_voucher）。每笔 POSTED 申请单生成，含"AirBank 培训环境专用"行章标识。
 */
@Data
@TableName(value = "t_voucher", autoResultMap = true)
public class Voucher {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long ctTxnId;

    /** VCH + 12 位随机大写字母数字 */
    private String voucherNo;

    private String voucherType;

    @TableField(typeHandler = JsonbTypeHandler.class)
    private Map<String, Object> content;

    private LocalDateTime generatedAt;
}
