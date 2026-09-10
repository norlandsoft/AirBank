package com.airbank.wealth.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

/**
 * 清算指令（t_settlement_instruction，docs/design/06 §4）。
 * 每持仓两条：PRINCIPAL（本金，WEALTH_REDEEM）+ INCOME（收益，WEALTH_INCOME）。
 * request_no 唯一 → 幂等调核心，可断点重跑。
 */
@Data
@TableName("t_settlement_instruction")
public class SettlementInstruction {

    public static final String TYPE_PRINCIPAL = "PRINCIPAL";
    public static final String TYPE_INCOME = "INCOME";

    public static final String ST_NEW = "NEW";
    public static final String ST_DONE = "DONE";
    public static final String ST_FAILED = "FAILED";

    private Long id;
    private String batchNo;
    private Long positionId;
    private String instructionType;
    private Long amount;
    /** 幂等键：STLI:{batchNo}:{positionId}:{type} */
    private String requestNo;
    private String txnNo;
    private String status;
}
