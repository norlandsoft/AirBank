package com.airbank.counter.mapper;

import com.airbank.counter.entity.CashBox;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDate;

@Mapper
public interface CashBoxMapper extends BaseMapper<CashBox> {

    /** 尾箱记账前悲观行锁 */
    @Select("SELECT * FROM t_cash_box WHERE teller_no = #{tellerNo} AND shift_date = #{shiftDate} FOR UPDATE")
    CashBox selectForUpdate(@Param("tellerNo") String tellerNo, @Param("shiftDate") LocalDate shiftDate);
}
