package com.airbank.core.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDate;

@Data
@TableName("t_gl_balance")
public class GlBalance {

    @TableId(type = IdType.AUTO)
    private Long id;
    private LocalDate batchDate;
    private String subjectCode;
    private Long drSum;
    private Long crSum;
    private Long balance;
}
