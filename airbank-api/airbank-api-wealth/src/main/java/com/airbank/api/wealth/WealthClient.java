package com.airbank.api.wealth;

import com.airbank.api.wealth.dto.OrderVO;
import com.airbank.api.wealth.dto.PositionVO;
import com.airbank.api.wealth.dto.ProductVO;
import com.airbank.api.wealth.dto.RedeemCmd;
import com.airbank.api.wealth.dto.SubscribeCmd;
import com.airbank.common.api.Result;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.List;

/**
 * 理财系统服务间契约。
 */
@FeignClient(name = "airbank-wealth", contextId = "wealthClient", path = "/api/wealth")
public interface WealthClient {

    @GetMapping("/products")
    Result<List<ProductVO>> listProducts(@RequestParam(value = "status", required = false) String status);

    @GetMapping("/products/{code}")
    Result<ProductVO> getProduct(@PathVariable("code") String code);

    @PostMapping("/orders/subscribe")
    Result<OrderVO> subscribe(@RequestBody SubscribeCmd cmd);

    @PostMapping("/orders/redeem")
    Result<OrderVO> redeem(@RequestBody RedeemCmd cmd);

    @GetMapping("/orders/{orderNo}")
    Result<OrderVO> getOrder(@PathVariable("orderNo") String orderNo);

    @GetMapping("/positions")
    Result<List<PositionVO>> positions(@RequestParam("customerId") Long customerId);

    @PostMapping("/internal/batch/confirm/trigger")
    Result<String> triggerConfirm(@RequestParam(value = "batchDate", required = false) String batchDate);

    @PostMapping("/internal/batch/accrual/trigger")
    Result<String> triggerAccrual(@RequestParam(value = "batchDate", required = false) String batchDate);

    @PostMapping("/internal/batch/settle/trigger")
    Result<String> triggerSettle(@RequestParam(value = "batchDate", required = false) String batchDate);

    @PostMapping("/internal/recon/trigger")
    Result<String> triggerRecon(@RequestParam(value = "batchDate", required = false) String batchDate);
}
