package com.airbank.ebank.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

/**
 * 收款人名册（t_beneficiary）。UNIQUE(customer_id, payee_acct)。
 */
@Data
@TableName("t_beneficiary")
public class Beneficiary {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long customerId;

    private String payeeName;

    private String payeeAcct;

    private String bankName;

    private String alias;
}
