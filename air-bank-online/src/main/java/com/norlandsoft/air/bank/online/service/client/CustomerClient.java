package com.norlandsoft.air.bank.online.service.client;

import org.springframework.cloud.openfeign.FeignClient;

/**
 * Created by ChaiMingXu, on 2025/7/4
 */
@FeignClient(name = "user-service")
public interface CustomerClient {
}
