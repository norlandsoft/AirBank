package com.airbank.core.mapper;

import com.airbank.core.entity.Account;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface AccountMapper extends BaseMapper<Account> {

    /** 悲观行锁（余额变动前置，docs/design/03 §6） */
    @Select("SELECT * FROM t_account WHERE acct_no = #{acctNo} FOR UPDATE")
    Account selectForUpdate(@Param("acctNo") String acctNo);
}
