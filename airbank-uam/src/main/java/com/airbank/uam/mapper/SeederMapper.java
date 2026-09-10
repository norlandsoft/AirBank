package com.airbank.uam.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface SeederMapper {

    @Select("SELECT COALESCE(MAX(id), 0) FROM t_customer")
    long maxCustomerId();

    @Select("SELECT setval('t_customer_id_seq', #{next}, false)")
    long setCustomerSeq(@Param("next") long next);
}
