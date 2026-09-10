package com.airbank.counter.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 柜员班次（t_teller_shift，docs/design/05 §2.1）。当日唯一 UNIQUE(teller_no, shift_date)。
 */
@Data
@TableName("t_teller_shift")
public class TellerShift {

    public static final String ST_OPEN = "OPEN";
    public static final String ST_CLOSED = "CLOSED";

    @TableId(type = IdType.AUTO)
    private Long id;

    private String tellerNo;

    private String branchNo;

    private LocalDate shiftDate;

    private LocalDateTime signInAt;

    private LocalDateTime signOutAt;

    private String status;
}
