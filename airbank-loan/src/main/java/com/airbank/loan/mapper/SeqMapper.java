package com.airbank.loan.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface SeqMapper {

    /** 取数据库序列下一值（seq_apply / seq_loan / seq_repay，编号生成用） */
    @Select("SELECT nextval(#{name})")
    long nextval(String name);
}
