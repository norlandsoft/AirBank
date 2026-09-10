package com.airbank.uam.controller;

import com.airbank.api.uam.dto.CustomerCreateCmd;
import com.airbank.api.uam.dto.CustomerDTO;
import com.airbank.common.api.PageResult;
import com.airbank.common.api.Result;
import com.airbank.common.security.RequirePerm;
import com.airbank.uam.entity.Customer;
import com.airbank.uam.service.CustomerService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/customers")
@RequiredArgsConstructor
public class CustomerController {

    private final CustomerService customerService;

    @PostMapping
    @RequirePerm("counter:customer-create")
    public Result<CustomerDTO> create(@Valid @RequestBody CustomerCreateCmd cmd) {
        return Result.ok(customerService.create(cmd));
    }

    @GetMapping
    @RequirePerm("counter:customer-query")
    public Result<PageResult<CustomerDTO>> page(@RequestParam(defaultValue = "1") int pageNum,
                                                @RequestParam(defaultValue = "20") int pageSize,
                                                @RequestParam(required = false) String keyword) {
        var page = customerService.page(pageNum, pageSize, keyword);
        List<CustomerDTO> list = page.getRecords().stream().map(customerService::toDto).toList();
        return Result.ok(new PageResult<>(list, page.getTotal(), pageNum, pageSize));
    }

    @GetMapping("/{id}")
    @RequirePerm("counter:customer-query")
    public Result<CustomerDTO> get(@PathVariable Long id) {
        return Result.ok(customerService.toDto(customerService.requireEntity(id)));
    }

    @PutMapping("/{id}")
    @RequirePerm("counter:customer-create")
    public Result<CustomerDTO> update(@PathVariable Long id, @Valid @RequestBody CustomerCreateCmd cmd) {
        return Result.ok(customerService.update(id, cmd));
    }
}
