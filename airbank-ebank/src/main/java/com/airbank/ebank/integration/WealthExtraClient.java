package com.airbank.ebank.integration;

import com.airbank.api.wealth.dto.OrderVO;
import com.airbank.common.api.PageResult;
import com.airbank.common.api.Result;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

/**
 * 局部契约扩展（理财订单按客户查询）：airbank-api-wealth 的 WealthClient 暂无该方法，
 * 此客户端按理财服务 GET /orders?customerId= 端点声明。
 * 联调点：若 wealth 服务未实现该端点（404），网银侧降级返回空页。
 */
@FeignClient(name = "airbank-wealth", contextId = "wealthOrderClient", path = "/api/wealth")
public interface WealthExtraClient {

    @GetMapping("/orders")
    Result<PageResult<OrderVO>> orders(@RequestParam("customerId") Long customerId,
                                       @RequestParam("pageNum") int pageNum,
                                       @RequestParam("pageSize") int pageSize);
}
