package com.airbank.ebank.controller;

import com.airbank.common.api.PageResult;
import com.airbank.common.api.Result;
import com.airbank.ebank.model.EbankTxnVO;
import com.airbank.ebank.model.LimitAdjustCmd;
import com.airbank.ebank.model.LimitVO;
import com.airbank.ebank.model.TransferCmd;
import com.airbank.ebank.model.TransferVO;
import com.airbank.ebank.service.OwnerGuard;
import com.airbank.ebank.service.TransferService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 转账与限额（docs/design/05 §3.2，均限本人）。
 */
@RestController
@RequiredArgsConstructor
public class TransferController {

    private final TransferService transferService;

    @GetMapping("/transfers/limit")
    public Result<LimitVO> limit() {
        return Result.ok(transferService.limit(OwnerGuard.requireCustomerId()));
    }

    @PutMapping("/transfers/limit")
    public Result<LimitVO> adjustLimit(@Valid @RequestBody LimitAdjustCmd cmd) {
        return Result.ok(transferService.adjustLimit(OwnerGuard.requireCustomerId(), cmd));
    }

    @PostMapping("/transfers")
    public Result<TransferVO> transfer(@Valid @RequestBody TransferCmd cmd) {
        return Result.ok(transferService.transfer(OwnerGuard.requireCustomerId(), cmd));
    }

    @GetMapping("/transfers")
    public Result<PageResult<EbankTxnVO>> transfers(@RequestParam(defaultValue = "1") int pageNum,
                                                    @RequestParam(defaultValue = "20") int pageSize) {
        return Result.ok(transferService.page(OwnerGuard.requireCustomerId(), pageNum, pageSize));
    }
}
