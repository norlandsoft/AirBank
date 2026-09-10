package com.airbank.core.controller;

import com.airbank.api.core.dto.AccountStatusCmd;
import com.airbank.api.core.dto.AccountVO;
import com.airbank.api.core.dto.OpenAccountCmd;
import com.airbank.common.api.Result;
import com.airbank.core.service.AccountService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class AccountController {

    private final AccountService accountService;

    @PostMapping("/accounts")
    public Result<AccountVO> open(@Valid @RequestBody OpenAccountCmd cmd,
                                  @RequestHeader(value = "X-Batch-Date", required = false) String batchDate) {
        return Result.ok(accountService.open(cmd, accountService.batchDateOf(batchDate)));
    }

    @GetMapping("/accounts/{acctNo}")
    public Result<AccountVO> get(@PathVariable String acctNo) {
        return Result.ok(accountService.byAcctNo(acctNo));
    }

    @GetMapping("/accounts/by-card/{cardNo}")
    public Result<AccountVO> byCard(@PathVariable String cardNo) {
        AccountVO vo = accountService.byCardNo(cardNo);
        return Result.ok(vo);
    }

    @GetMapping("/accounts")
    public Result<List<AccountVO>> byCustomer(@RequestParam Long customerId) {
        return Result.ok(accountService.byCustomer(customerId));
    }

    @PostMapping("/accounts/{acctNo}/status")
    public Result<AccountVO> changeStatus(@PathVariable String acctNo,
                                          @RequestHeader(value = "X-Batch-Date", required = false) String batchDate,
                                          @Valid @RequestBody AccountStatusCmd cmd) {
        return Result.ok(accountService.changeStatus(acctNo, cmd, accountService.batchDateOf(batchDate)));
    }
}
