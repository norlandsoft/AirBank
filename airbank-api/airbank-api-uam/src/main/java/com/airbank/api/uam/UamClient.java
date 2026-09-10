package com.airbank.api.uam;

import com.airbank.api.uam.dto.CustomerCreateCmd;
import com.airbank.api.uam.dto.CustomerDTO;
import com.airbank.common.api.Result;
import jakarta.validation.Valid;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;

/**
 * 用户中心服务间契约（/internal/** 仅限内网渠道与领域服务调用）。
 */
@FeignClient(name = "airbank-uam", contextId = "uamClient", path = "/api/uam")
public interface UamClient {

    @PostMapping("/internal/customers")
    Result<CustomerDTO> createCustomer(@Valid @RequestBody CustomerCreateCmd cmd);

    @GetMapping("/internal/customers/{id}")
    Result<CustomerDTO> getCustomer(@PathVariable("id") Long id);

    @GetMapping("/internal/customers/by-id-no")
    Result<CustomerDTO> getByIdNo(@RequestParam("idNo") String idNo);

    @GetMapping("/internal/customers/by-customer-no")
    Result<CustomerDTO> getByCustomerNo(@RequestParam("customerNo") String customerNo);

    @GetMapping("/internal/customers/{id}/risk-level")
    Result<String> getRiskLevel(@PathVariable("id") Long id);

    @PostMapping("/internal/otp/send")
    Result<Void> sendOtp(@RequestParam("scene") String scene, @RequestParam("target") String target);

    @PostMapping("/internal/otp/verify")
    Result<Boolean> verifyOtp(@RequestParam("scene") String scene,
                              @RequestParam("target") String target,
                              @RequestParam("code") String code);
}
