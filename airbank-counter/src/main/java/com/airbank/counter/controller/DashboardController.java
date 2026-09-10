package com.airbank.counter.controller;

import com.airbank.common.api.Result;
import com.airbank.counter.model.DashboardVO;
import com.airbank.counter.service.DashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 工作台看板（docs/design/05 §2.3）。
 */
@RestController
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;

    @GetMapping("/dashboard")
    public Result<DashboardVO> dashboard() {
        return Result.ok(dashboardService.dashboard());
    }
}
