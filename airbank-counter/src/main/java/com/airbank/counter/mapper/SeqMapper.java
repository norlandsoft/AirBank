package com.airbank.counter.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface SeqMapper {

    /** 柜面申请单序号：seq_ct（deploy/postgres/init/40-counter-schema.sql） */
    @Select("SELECT nextval(#{name})")
    long nextval(String name);
}
