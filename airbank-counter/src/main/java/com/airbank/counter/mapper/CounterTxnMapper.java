package com.airbank.counter.mapper;

import com.airbank.counter.entity.CounterTxn;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDate;

@Mapper
public interface CounterTxnMapper extends BaseMapper<CounterTxn> {

    @Select("SELECT COALESCE(SUM(amount), 0) FROM t_counter_txn "
            + "WHERE status = 'POSTED' AND teller_no = #{tellerNo} AND shift_date = #{shiftDate}")
    long sumPostedAmount(@Param("tellerNo") String tellerNo, @Param("shiftDate") LocalDate shiftDate);

    @Select("SELECT COUNT(*) FROM t_counter_txn WHERE status = 'PENDING_REVIEW'")
    long countPendingReview();
}
