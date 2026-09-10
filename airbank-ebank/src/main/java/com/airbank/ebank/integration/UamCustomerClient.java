package com.airbank.ebank.integration;

import com.airbank.common.api.Result;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;

/**
 * 局部契约扩展（客户维度校验/OTP）：airbank-api-uam 的 UamClient 暂无对应方法，
 * 此客户端按 UAM 已有内部端点声明（/internal/customers/{id}/...）。
 */
@FeignClient(name = "airbank-uam", contextId = "uamCustomerClient", path = "/api/uam")
public interface UamCustomerClient {

    @PostMapping("/internal/customers/{id}/mobile/verify")
    Result<Boolean> verifyMobile(@PathVariable("id") Long id, @RequestParam("mobile") String mobile);

    /** 向客户预留手机号发送 OTP（scene: REGISTER/TRANSFER/LIMIT/WEALTH） */
    @PostMapping("/internal/customers/{id}/otp/send")
    Result<Void> sendCustomerOtp(@PathVariable("id") Long id, @RequestParam("scene") String scene);

    @PostMapping("/internal/customers/{id}/otp/verify")
    Result<Boolean> verifyCustomerOtp(@PathVariable("id") Long id,
                                      @RequestParam("scene") String scene,
                                      @RequestParam("code") String code);

    /** 培训环境特性：查看客户最新验证码（docs/design/05 §1.2，ADR-8） */
    @PostMapping("/internal/customers/{id}/otp/latest")
    Result<String> latestCustomerOtp(@PathVariable("id") Long id, @RequestParam("scene") String scene);
}
