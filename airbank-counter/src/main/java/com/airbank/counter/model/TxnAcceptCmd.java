package com.airbank.counter.model;

import lombok.Data;

import java.util.Map;

/**
 * 统一受理扁平报文（docs/design/05 §2.2）。整单以 Map 形式落 t_counter_txn.payload。
 * amount 单位：分。
 */
@Data
public class TxnAcceptCmd {

    private String bizType;

    /** 幂等键，可空（为空时系统生成） */
    private String requestNo;

    private String acctNo;

    private String toAcct;

    private String depositNo;

    /** REVERSE：被冲正的核心流水号 */
    private String txnNo;

    private String productCode;

    private Integer termMonths;

    private Long customerId;

    /** ACCOUNT_OPEN 且无 customerId 时创建客户：{customerName,idType,idNo,mobile,...} */
    private Map<String, Object> customerCmd;

    private Long amount;

    /** 冻结/解冻/销户原因 */
    private String reason;

    /** 流水摘要 */
    private String summary;
}
