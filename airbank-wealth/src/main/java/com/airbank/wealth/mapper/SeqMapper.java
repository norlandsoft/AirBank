package com.airbank.wealth.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface SeqMapper {

    /** 取数据库序列下一值（如 seq_order，理财订单号生成用） */
    @Select("SELECT nextval(#{name})")
    long nextval(String name);
}
