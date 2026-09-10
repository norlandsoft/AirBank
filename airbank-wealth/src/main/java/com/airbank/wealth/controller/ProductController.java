package com.airbank.wealth.controller;

import com.airbank.api.wealth.dto.ProductVO;
import com.airbank.common.api.Result;
import com.airbank.common.security.AuthContext;
import com.airbank.common.security.RequirePerm;
import com.airbank.wealth.model.ProductCreateCmd;
import com.airbank.wealth.service.ProductService;
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
 * 产品接口：列表/详情（渠道）；新建/上架/下架（管理端，admin:manage）。
 */
@RestController
@RequestMapping("/products")
@RequiredArgsConstructor
public class ProductController {

    private final ProductService productService;

    @GetMapping
    public Result<List<ProductVO>> list(@RequestParam(required = false) String status) {
        return Result.ok(productService.list(status));
    }

    @GetMapping("/{code}")
    public Result<ProductVO> get(@PathVariable String code) {
        return Result.ok(productService.get(code));
    }

    @PostMapping
    @RequirePerm("admin:manage")
    public Result<ProductVO> create(@RequestBody ProductCreateCmd cmd) {
        return Result.ok(productService.create(cmd, AuthContext.require().loginName()));
    }

    @PostMapping("/{code}/on-sale")
    @RequirePerm("admin:manage")
    public Result<ProductVO> onSale(@PathVariable String code) {
        return Result.ok(productService.onSale(code, AuthContext.require().loginName()));
    }

    @PostMapping("/{code}/off-sale")
    @RequirePerm("admin:manage")
    public Result<ProductVO> offSale(@PathVariable String code) {
        return Result.ok(productService.offSale(code, AuthContext.require().loginName()));
    }
}
