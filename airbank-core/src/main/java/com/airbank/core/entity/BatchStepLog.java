package com.airbank.core.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("t_batch_step_log")
public class BatchStepLog {

    @TableId(type = IdType.AUTO)
    private Long id;
    private Long taskId;
    private Integer stepNo;
    private String stepName;
    private Integer rows;
    private String status;
    private String message;
    private Long costMs;
}
