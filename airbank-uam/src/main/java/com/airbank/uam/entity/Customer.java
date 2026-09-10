package com.airbank.uam.entity;

import com.airbank.common.db.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDate;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("t_customer")
public class Customer extends BaseEntity {

    private Long id;
    private String customerNo;
    private String customerName;
    private String idType;
    private String idNoEnc;
    private String idNoHash;
    private String idNoMask;
    private String mobileEnc;
    private String mobileHash;
    private String mobileMask;
    private String gender;
    private String occupation;
    private String address;
    private String riskLevel;
    private LocalDate riskAssessDate;
    private String status;
}
