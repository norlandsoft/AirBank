package com.airbank.core.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.airbank.common.db.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDate;

/** 会计分录（append-only，docs/design/03 §2.2） */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("t_journal")
public class Journal extends BaseEntity {

    public static final String DR = "DR";
    public static final String CR = "CR";

    private Long id;
    private String txnNo;
    private Integer entryNo;
    private String drCr;
    private String subjectCode;
    private String acctNo;
    private Long amount;
    private Long balanceAfter;
    private String summary;
    private LocalDate batchDate;
}
