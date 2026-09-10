package com.airbank.uam.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface SeqMapper {

    @Select("SELECT nextval(#{name})")
    long nextval(String name);
}
