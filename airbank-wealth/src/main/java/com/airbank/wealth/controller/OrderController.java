package com.airbank.wealth.controller;

import com.airbank.api.wealth.dto.OrderVO;
import com.airbank.api.wealth.dto.RedeemCmd;
import com.airbank.api.wealth.dto.SubscribeCmd;
import com.airbank.common.api.Result;
import com.airbank.wealth.service.OrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 申赎订单接口（docs/design/04 §2/§3）：
 * 申购下单即扣款（核心 WEALTH_SUBSCRIBE 幂等），赎回 T+1 清算兑付。
 */
@RestController
@RequestMapping("/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;

    @PostMapping("/subscribe")
    public Result<OrderVO> subscribe(@RequestBody SubscribeCmd cmd) {
        return Result.ok(orderService.subscribe(cmd));
    }

    @PostMapping("/redeem")
    public Result<OrderVO> redeem(@RequestBody RedeemCmd cmd) {
        return Result.ok(orderService.redeem(cmd));
    }

    /** 订单查询：按订单号/客户/产品/状态（可组合） */
    /** 分页查询（网银渠道按 customerId 查询） */
    @GetMapping(params = {"customerId", "pageNum"})
    public Result<com.airbank.common.api.PageResult<OrderVO>> pageByCustomer(
            @RequestParam Long customerId,
            @RequestParam(defaultValue = "1") int pageNum,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam(required = false) String status) {
        var page = orderService.page(customerId, status, pageNum, pageSize);
        return Result.ok(new com.airbank.common.api.PageResult<>(page.getList(), page.getTotal(), page.getPageNum(), page.getPageSize()));
    }

    @GetMapping
    public Result<List<OrderVO>> list(@RequestParam(required = false) Long customerId,
                                      @RequestParam(required = false) String productCode,
                                      @RequestParam(required = false) String status,
                                      @RequestParam(required = false) String orderNo) {
        return Result.ok(orderService.list(customerId, productCode, status, orderNo));
    }

    @GetMapping("/{orderNo}")
    public Result<OrderVO> get(@PathVariable String orderNo) {
        return Result.ok(orderService.byOrderNo(orderNo));
    }
}
