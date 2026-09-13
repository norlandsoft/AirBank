package com.airbank.loan.controller;

import com.airbank.api.loan.dto.LoanProductVO;
import com.airbank.common.api.Result;
import com.airbank.loan.service.LoanProductService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 贷款产品（docs/design/13 §4.1）。
 */
@RestController
@RequestMapping("/products")
@RequiredArgsConstructor
public class ProductController {

    private final LoanProductService productService;

    @GetMapping
    public Result<List<LoanProductVO>> list(@RequestParam(value = "status", required = false) String status) {
        return Result.ok(productService.list(status));
    }

    @GetMapping("/{code}")
    public Result<LoanProductVO> get(@PathVariable("code") String code) {
        return Result.ok(LoanProductService.toVo(productService.require(code)));
    }
}
