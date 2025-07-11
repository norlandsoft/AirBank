package com.norlandsoft.air.bank.ecif.controller;

import com.norlandsoft.air.bank.entity.Customer;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Created by ChaiMingXu, on 2025/7/4
 */
@RestController
@RequestMapping("/api/ecif/customer")
public class CustomerController {

  @PostMapping("/info")
  public Customer getCustomerInfo(@RequestBody String id) {
    Customer c = new Customer();
    c.setId("1212");
    c.setName("张飞");
    c.setGender("M");
    c.setCnid("110101198001012012");
    return c;
  }

}
