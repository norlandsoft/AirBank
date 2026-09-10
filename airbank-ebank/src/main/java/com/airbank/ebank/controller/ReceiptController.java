package com.airbank.ebank.controller;

import com.airbank.common.api.PageResult;
import com.airbank.common.api.Result;
import com.airbank.ebank.model.ReceiptVO;
import com.airbank.ebank.service.OwnerGuard;
import com.airbank.ebank.service.ReceiptService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 电子回单（仅本人）。
 */
@RestController
@RequiredArgsConstructor
public class ReceiptController {

    private final ReceiptService receiptService;

    @GetMapping("/receipts")
    public Result<PageResult<ReceiptVO>> list(@RequestParam(defaultValue = "1") int pageNum,
                                              @RequestParam(defaultValue = "20") int pageSize) {
        return Result.ok(receiptService.page(OwnerGuard.requireCustomerId(), pageNum, pageSize));
    }

    @GetMapping("/receipts/{receiptNo}")
    public Result<ReceiptVO> detail(@PathVariable String receiptNo) {
        return Result.ok(receiptService.byReceiptNo(OwnerGuard.requireCustomerId(), receiptNo));
    }
}
