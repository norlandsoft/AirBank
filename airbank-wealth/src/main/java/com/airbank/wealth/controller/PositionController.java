package com.airbank.wealth.controller;

import com.airbank.api.wealth.dto.PositionVO;
import com.airbank.common.api.Result;
import com.airbank.wealth.model.IncomeVO;
import com.airbank.wealth.service.PositionService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 持仓接口：按客户查持仓、持仓收益明细（按日）。
 */
@RestController
@RequestMapping("/positions")
@RequiredArgsConstructor
public class PositionController {

    private final PositionService positionService;

    @GetMapping
    public Result<List<PositionVO>> list(@RequestParam Long customerId) {
        return Result.ok(positionService.listByCustomer(customerId));
    }

    @GetMapping("/{id}/incomes")
    public Result<List<IncomeVO>> incomes(@PathVariable Long id) {
        return Result.ok(positionService.incomes(id));
    }
}
