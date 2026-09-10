package com.airbank.ebank.controller;

import com.airbank.api.wealth.dto.OrderVO;
import com.airbank.api.wealth.dto.PositionVO;
import com.airbank.common.api.PageResult;
import com.airbank.common.api.Result;
import com.airbank.ebank.model.ProductCardVO;
import com.airbank.ebank.model.RedeemReq;
import com.airbank.ebank.model.SubscribeReq;
import com.airbank.ebank.service.OwnerGuard;
import com.airbank.ebank.service.WealthFacade;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 理财超市（docs/design/05 §3.3，渠道编排，均限本人）。
 */
@RestController
@RequiredArgsConstructor
public class WealthController {

    private final WealthFacade wealthFacade;

    @GetMapping("/wealth/products")
    public Result<List<ProductCardVO>> products() {
        return Result.ok(wealthFacade.products(OwnerGuard.requireCustomerId()));
    }

    @PostMapping("/wealth/subscribe")
    public Result<OrderVO> subscribe(@Valid @RequestBody SubscribeReq req) {
        return Result.ok(wealthFacade.subscribe(OwnerGuard.requireCustomerId(), req));
    }

    @PostMapping("/wealth/redeem")
    public Result<OrderVO> redeem(@Valid @RequestBody RedeemReq req) {
        return Result.ok(wealthFacade.redeem(OwnerGuard.requireCustomerId(), req));
    }

    @GetMapping("/wealth/positions")
    public Result<List<PositionVO>> positions() {
        return Result.ok(wealthFacade.positions(OwnerGuard.requireCustomerId()));
    }

    @GetMapping("/wealth/orders")
    public Result<PageResult<OrderVO>> orders(@RequestParam(defaultValue = "1") int pageNum,
                                              @RequestParam(defaultValue = "20") int pageSize) {
        return Result.ok(wealthFacade.orders(OwnerGuard.requireCustomerId(), pageNum, pageSize));
    }
}
