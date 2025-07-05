package com.norlandsoft.air.bank.online.dao;

import com.norlandsoft.air.bank.entity.User;
import org.apache.ibatis.annotations.Mapper;

/**
 * Created by ChaiMingXu, on 2025/7/5
 */
@Mapper
public interface UserMapper {
  User getUserById(String id);
}
