package com.airbank.wealth.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

/**
 * 对账差异明细（t_recon_diff，docs/design/06 §4）。
 * v1 只出报告不自动调账，供培训分析（docs/design/04 §7）。
 */
@Data
@TableName("t_recon_diff")
public class ReconDiff {

    public static final String TYPE_BALANCE = "BALANCE";
    public static final String TYPE_TXN = "TXN";

    private Long id;
    private Long taskId;
    private String diffType;
    private String bizKey;
    private Long coreAmount;
    private Long wealthAmount;
    private String remark;
}
