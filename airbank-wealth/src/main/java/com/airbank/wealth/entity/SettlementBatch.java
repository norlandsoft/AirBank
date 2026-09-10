package com.airbank.wealth.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 到期清算批次（t_settlement_batch，docs/design/06 §4）。
 * batch_no = STL:{productCode}:{yyyyMMdd}，产品维度本金/收益汇总。
 */
@Data
@TableName("t_settlement_batch")
public class SettlementBatch {

    public static final String ST_RUNNING = "RUNNING";
    public static final String ST_SUCCESS = "SUCCESS";
    public static final String ST_FAILED = "FAILED";

    private Long id;
    private String batchNo;
    private Long productId;
    private LocalDate batchDate;
    private Long principalTotal;
    private Long incomeTotal;
    private String status;
    private LocalDateTime createdAt;
}
