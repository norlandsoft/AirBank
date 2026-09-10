package com.airbank.wealth.controller;

import com.airbank.common.api.Result;
import com.airbank.wealth.batch.AccrualService;
import com.airbank.wealth.batch.ConfirmBatchService;
import com.airbank.wealth.batch.ReconService;
import com.airbank.wealth.batch.SettleService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

/**
 * 服务间内部契约（/internal/**，与 airbank-api-wealth 的 WealthClient 一致）：
 * 供柜面/网银聚合转发与培训快进日切。batchDate 缺省为今天。
 */
@RestController
@RequestMapping("/internal")
@RequiredArgsConstructor
public class InternalController {

    private final ConfirmBatchService confirmBatchService;
    private final AccrualService accrualService;
    private final SettleService settleService;
    private final ReconService reconService;

    @PostMapping("/batch/confirm/trigger")
    public Result<String> triggerConfirm(@RequestParam(required = false) String batchDate) {
        return Result.ok(confirmBatchService.trigger(date(batchDate)));
    }

    @PostMapping("/batch/accrual/trigger")
    public Result<String> triggerAccrual(@RequestParam(required = false) String batchDate) {
        return Result.ok(accrualService.trigger(date(batchDate)));
    }

    @PostMapping("/batch/settle/trigger")
    public Result<String> triggerSettle(@RequestParam(required = false) String batchDate) {
        return Result.ok(settleService.trigger(date(batchDate)));
    }

    @PostMapping("/recon/trigger")
    public Result<String> triggerRecon(@RequestParam(required = false) String batchDate) {
        return Result.ok(reconService.trigger(date(batchDate)));
    }

    private LocalDate date(String s) {
        return s == null || s.isBlank() ? LocalDate.now() : LocalDate.parse(s);
    }
}
