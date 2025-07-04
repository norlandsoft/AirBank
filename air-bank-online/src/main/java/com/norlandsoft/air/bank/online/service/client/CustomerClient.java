package com.norlandsoft.air.bank.online.service.client;

import com.norlandsoft.air.bank.entity.Customer;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

/**
 * Created by ChaiMingXu, on 2025/7/4
 */
@FeignClient(name = "bank-ecif")
public interface CustomerClient {

  @PostMapping("/api/ecif/customer/info")
  Customer getCustomer(@RequestBody String id);

}
