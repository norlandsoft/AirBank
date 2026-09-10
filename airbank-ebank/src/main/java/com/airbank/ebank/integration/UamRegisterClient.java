package com.airbank.ebank.integration;

import com.airbank.common.api.Result;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

import java.util.Map;

/**
 * 局部契约扩展（网银注册专用）：airbank-api-uam 暂无网银自助注册方法，
 * 此客户端按 UAM 已有内部端点 /internal/users/customer-register 声明。
 * 请求体结构 = UAM CustomerRegisterCmd(customerId, loginName, password, realName?, mobileMask?)。
 */
@FeignClient(name = "airbank-uam", contextId = "uamRegisterClient", path = "/api/uam")
public interface UamRegisterClient {

    @PostMapping("/internal/users/customer-register")
    Result<Long> register(@RequestBody Map<String, Object> cmd);
}
