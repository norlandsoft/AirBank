package com.airbank.api.core.dto;

import lombok.Data;

/**
 * 流水查询条件（GET /txns 分页）。
 */
@Data
public class TxnQuery {

    private String acctNo;
    private Long customerId;
    private String txnType;
    private String channel;
    private String status;
    private String beginDate;
    private String endDate;
    private Integer pageNum = 1;
    private Integer pageSize = 20;
}
