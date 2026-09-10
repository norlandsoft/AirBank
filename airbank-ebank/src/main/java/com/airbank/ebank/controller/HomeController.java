package com.airbank.ebank.controller;

import com.airbank.common.api.Result;
import com.airbank.ebank.model.HomeVO;
import com.airbank.ebank.model.ProfileVO;
import com.airbank.ebank.service.HomeService;
import com.airbank.ebank.service.OwnerGuard;
import com.airbank.api.uam.UamClient;
import com.airbank.api.uam.dto.CustomerDTO;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 登录后首页：资产总览 + 个人信息。
 */
@RestController
@RequiredArgsConstructor
public class HomeController {

    private final HomeService homeService;
    private final UamClient uamClient;

    @GetMapping("/home")
    public Result<HomeVO> home() {
        return Result.ok(homeService.home(OwnerGuard.requireCustomerId()));
    }

    @GetMapping("/profile")
    public Result<ProfileVO> profile() {
        Long customerId = OwnerGuard.requireCustomerId();
        CustomerDTO c = OwnerGuard.data(uamClient.getCustomer(customerId));
        return Result.ok(new ProfileVO(c == null ? null : c.customerNo(),
                c == null ? null : c.customerName(),
                c == null ? null : c.mobileMask(),
                c == null ? null : c.riskLevel()));
    }
}
