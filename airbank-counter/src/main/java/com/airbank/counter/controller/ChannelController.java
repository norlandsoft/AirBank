package com.airbank.counter.controller;

import com.airbank.api.core.dto.AccountVO;
import com.airbank.api.uam.dto.CustomerDTO;
import com.airbank.api.wealth.dto.ProductVO;
import com.airbank.common.api.Result;
import com.airbank.common.exception.BizException;
import com.airbank.common.exception.ErrorCodes;
import com.airbank.common.security.RequirePerm;
import com.airbank.counter.service.ChannelQueryService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 渠道查询代理：账户（核心）/ 客户（用户中心）/ 理财产品（docs/design/05 §2.3）。
 */
@RestController
@RequiredArgsConstructor
public class ChannelController {

    private final ChannelQueryService channelQueryService;

    @GetMapping("/accounts/{acctNo}")
    public Result<AccountVO> account(@PathVariable String acctNo) {
        return Result.ok(channelQueryService.account(acctNo));
    }

    /** 客户查询：keyword = 客户号或证件号（逐个尝试），需 counter:customer-query 权限 */
    @RequirePerm("counter:customer-query")
    @GetMapping("/customers")
    public Result<List<CustomerDTO>> customers(@RequestParam String keyword) {
        if (keyword == null || keyword.isBlank()) {
            throw BizException.of(ErrorCodes.PARAM_INVALID, "请输入客户号或证件号");
        }
        return Result.ok(channelQueryService.customerByKeyword(keyword.trim()));
    }

    @GetMapping("/products")
    public Result<List<ProductVO>> products() {
        return Result.ok(channelQueryService.productsOnSale());
    }
}
