package com.airbank.counter.model;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 签到/工作台班次视图：班次 + 尾箱 + 日结状态。
 */
public record ShiftVO(
        Long shiftId,
        String tellerNo,
        String branchNo,
        LocalDate shiftDate,
        String status,
        LocalDateTime signInAt,
        LocalDateTime signOutAt,
        Long boxBegin,
        Long boxCashIn,
        Long boxCashOut,
        Long boxBalance,
        boolean settled,
        Boolean balanced
) {
}
