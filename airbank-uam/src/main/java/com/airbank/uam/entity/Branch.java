package com.airbank.uam.entity;

import com.airbank.common.db.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("t_branch")
public class Branch extends BaseEntity {

    private Long id;
    private String branchNo;
    private String branchName;
    private String address;
    private String status;
}
