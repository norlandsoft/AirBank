package com.airbank.uam.entity;

import com.airbank.common.db.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("t_user")
public class User extends BaseEntity {

    public static final String TYPE_TELLER = "TELLER";
    public static final String TYPE_CUSTOMER = "CUSTOMER";
    public static final String TYPE_ADMIN = "ADMIN";

    private Long id;
    private String userType;
    private String loginName;
    private String passwordHash;
    private Long customerId;
    private String tellerNo;
    private String branchNo;
    private String realName;
    private String mobileMask;
    private String status;
    private Integer failCount;
    private LocalDateTime lockUntil;
}
