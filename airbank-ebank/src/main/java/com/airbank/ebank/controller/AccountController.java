package com.airbank.ebank.controller;

import com.airbank.api.core.dto.AccountVO;
import com.airbank.api.core.dto.TimeDepositVO;
import com.airbank.api.core.dto.TxnVO;
import com.airbank.common.api.PageResult;
import com.airbank.common.api.Result;
import com.airbank.ebank.service.AccountQueryService;
import com.airbank.ebank.service.OwnerGuard;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 账户查询：账户列表 / 核心流水分页 / 定期存单（均限本人）。
 */
@RestController
@RequiredArgsConstructor
public class AccountController {

    private final AccountQueryService accountQueryService;

    @GetMapping("/accounts")
    public Result<List<AccountVO>> accounts() {
        return Result.ok(accountQueryService.myAccounts(OwnerGuard.requireCustomerId()));
    }

    @GetMapping("/accounts/{acctNo}/details")
    public Result<PageResult<TxnVO>> details(@PathVariable String acctNo,
                                             @RequestParam(defaultValue = "1") int pageNum,
                                             @RequestParam(defaultValue = "20") int pageSize) {
        return Result.ok(accountQueryService.accountDetails(OwnerGuard.requireCustomerId(), acctNo, pageNum, pageSize));
    }

    @GetMapping("/time-deposits")
    public Result<List<TimeDepositVO>> timeDeposits() {
        return Result.ok(accountQueryService.myTimeDeposits(OwnerGuard.requireCustomerId()));
    }
}
