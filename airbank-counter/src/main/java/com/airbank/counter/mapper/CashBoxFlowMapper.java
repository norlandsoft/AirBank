package com.airbank.counter.mapper;

import com.airbank.counter.entity.CashBoxFlow;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDate;

@Mapper
public interface CashBoxFlowMapper extends BaseMapper<CashBoxFlow> {

    @Select("SELECT COALESCE(SUM(amount), 0) FROM t_cash_box_flow "
            + "WHERE teller_no = #{tellerNo} AND shift_date = #{shiftDate} AND direction = #{direction}")
    long sumAmount(@Param("tellerNo") String tellerNo,
                   @Param("shiftDate") LocalDate shiftDate,
                   @Param("direction") String direction);
}
