package com.airbank.core.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("t_gl_subject")
public class GlSubject {

    @TableId(type = IdType.INPUT)
    private String subjectCode;
    private String subjectName;
    private String category;
    private String direction;
    private String status;
}
