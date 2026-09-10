package com.airbank.counter.controller;

import com.airbank.common.api.Result;
import com.airbank.counter.entity.DaySettlement;
import com.airbank.counter.service.DaySettlementService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 日结 / 签退前置（docs/design/05 §2.1）。
 */
@RestController
@RequestMapping("/day-settlement")
@RequiredArgsConstructor
public class DaySettlementController {

    private final DaySettlementService daySettlementService;

    @PostMapping
    public Result<DaySettlement> create() {
        return Result.ok(daySettlementService.create());
    }

    @GetMapping("/today")
    public Result<DaySettlement> today() {
        return Result.ok(daySettlementService.today());
    }
}
