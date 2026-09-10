package com.airbank.core.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("t_batch_task")
public class BatchTask {

    public static final String TYPE_DAY_END = "DAY_END";
    public static final String ST_PENDING = "PENDING";
    public static final String ST_RUNNING = "RUNNING";
    public static final String ST_SUCCESS = "SUCCESS";
    public static final String ST_FAILED = "FAILED";

    @TableId(type = IdType.AUTO)
    private Long id;
    private String batchType;
    private LocalDate batchDate;
    private String status;
    private Integer currentStep;
    private LocalDateTime startedAt;
    private LocalDateTime finishedAt;
    private String createdBy;
}
