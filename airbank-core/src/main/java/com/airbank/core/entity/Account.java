package com.airbank.core.entity;

import com.airbank.common.db.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.annotation.Version;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("t_account")
public class Account extends BaseEntity {

    public static final String TYPE_DEMAND = "DEMAND";
    public static final String TYPE_TIME = "TIME";

    private Long id;
    private String acctNo;
    private String cardNo;
    private Long customerId;
    private String acctType;
    private String productCode;
    private String subjectCode;
    private String branchNo;
    private Long balance;
    private Long frozenAmount;
    private Long accruedInterest;
    private LocalDate lastInterestDate;
    private String status;
    private LocalDateTime openedAt;
    private LocalDateTime closedAt;
    @Version
    private Integer version;
}
