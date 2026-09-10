package com.airbank.counter.controller;

import com.airbank.common.api.Result;
import com.airbank.counter.model.VoucherVO;
import com.airbank.counter.service.VoucherService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

/**
 * 回执管理（docs/design/05 §2.3）：当日/历史回执查询打印。
 */
@RestController
@RequestMapping("/vouchers")
@RequiredArgsConstructor
public class VoucherController {

    private final VoucherService voucherService;

    @GetMapping
    public Result<List<VoucherVO>> list(@RequestParam(required = false) LocalDate date) {
        return Result.ok(voucherService.list(date == null ? LocalDate.now() : date));
    }

    @GetMapping("/{voucherNo}")
    public Result<VoucherVO> get(@PathVariable String voucherNo) {
        return Result.ok(voucherService.byVoucherNo(voucherNo));
    }
}
