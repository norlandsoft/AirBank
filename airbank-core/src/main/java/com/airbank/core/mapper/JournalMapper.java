package com.airbank.core.mapper;

import com.airbank.core.entity.Journal;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface JournalMapper extends BaseMapper<Journal> {
}
