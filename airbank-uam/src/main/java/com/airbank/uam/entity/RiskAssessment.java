package com.airbank.uam.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("t_risk_assessment")
public class RiskAssessment {

    @TableId(type = IdType.AUTO)
    private Long id;
    private Long customerId;
    private Integer score;
    private String level;
    private String answers;
    private LocalDate assessDate;
    private LocalDate expireDate;
    private LocalDateTime createdAt;
}
