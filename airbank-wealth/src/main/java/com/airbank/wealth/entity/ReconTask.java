package com.airbank.wealth.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 理财-核心对账任务（t_recon_task，docs/design/06 §4）。
 * 比对：核心 2061 科目余额 vs Σ持仓 cost_amount（value_date ≤ batchDate，未清算持仓本金为 0 自然剔除）。
 */
@Data
@TableName("t_recon_task")
public class ReconTask {

    public static final String ST_DONE = "DONE";
    public static final String ST_DIFF = "DIFF";

    private Long id;
    /** batch_date 唯一，重跑覆盖 */
    private LocalDate batchDate;
    private String status;
    /** 核心 2061 代理理财资金余额 */
    private Long gl2061Balance;
    /** 理财持仓本金合计 */
    private Long positionPrincipalSum;
    private Long diff;
    private LocalDateTime createdAt;
}
