package com.norlandsoft.air.bank.online.service.impl;

import com.norlandsoft.air.bank.entity.User;
import com.norlandsoft.air.bank.online.dao.UserMapper;
import com.norlandsoft.air.bank.online.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Created by ChaiMingXu, on 2025/7/4
 */
@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {

  private final UserMapper mapper;

  @Override
  public User getUserById(String id) {
    User u = mapper.getUserById(id);
    u.setPassword(null);
    return u;
  }

  @Override
  public User userLogin(User user) {
    User u = mapper.getUserById(user.getId());
    if (u == null || u.getId() == null) {
      return null;
    }

    // 比较密码

    u.setPassword(null);
    u.setLoginStatus(User.LOGGED_IN);
    return u;
  }

}
