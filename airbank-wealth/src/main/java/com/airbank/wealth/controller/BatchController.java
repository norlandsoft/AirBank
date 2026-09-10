package com.airbank.wealth.controller;

import com.airbank.common.api.Result;
import com.airbank.common.security.RequirePerm;
import com.airbank.wealth.batch.ReconService;
import com.airbank.wealth.batch.SettleService;
import com.airbank.wealth.batch.AccrualService;
import com.airbank.wealth.batch.ConfirmBatchService;
import com.airbank.wealth.entity.Product;
import com.airbank.wealth.entity.ReconDiff;
import com.airbank.wealth.entity.ReconTask;
import com.airbank.wealth.entity.SettlementBatch;
import com.airbank.wealth.mapper.ProductMapper;
import com.airbank.wealth.mapper.SettlementBatchMapper;
import com.airbank.wealth.model.SettlementReportVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 批量与报告接口（管理端/培训手动触发，admin:manage）：
 * 确认 / 计提 / 清算 / 对账 触发 + 清算报告 + 对账差异查询。
 * 服务间调用请走 /internal/**（与 WealthClient 契约一致）。
 */
@RestController
@RequestMapping("/batch")
@RequiredArgsConstructor
public class BatchController {

    private final ConfirmBatchService confirmBatchService;
    private final AccrualService accrualService;
    private final SettleService settleService;
    private final ReconService reconService;
    private final SettlementBatchMapper batchMapper;
    private final ProductMapper productMapper;
    private final com.airbank.wealth.mapper.ReconTaskMapper reconTaskMapper;
    private final com.airbank.wealth.mapper.ReconDiffMapper reconDiffMapper;

    @PostMapping("/confirm/trigger")
    @RequirePerm("admin:manage")
    public Result<String> triggerConfirm(@RequestParam(required = false) String batchDate) {
        return Result.ok(confirmBatchService.trigger(date(batchDate)));
    }

    @PostMapping("/accrual/trigger")
    @RequirePerm("admin:manage")
    public Result<String> triggerAccrual(@RequestParam(required = false) String batchDate) {
        return Result.ok(accrualService.trigger(date(batchDate)));
    }

    @PostMapping("/settle/trigger")
    @RequirePerm("admin:manage")
    public Result<String> triggerSettle(@RequestParam(required = false) String batchDate) {
        return Result.ok(settleService.trigger(date(batchDate)));
    }

    @PostMapping("/recon/trigger")
    @RequirePerm("admin:manage")
    public Result<String> triggerRecon(@RequestParam(required = false) String batchDate) {
        return Result.ok(reconService.trigger(date(batchDate)));
    }

    /** 到期清算报告（产品维度本金/收益汇总） */
    @GetMapping("/settlement/reports")
    public Result<List<SettlementReportVO>> settlementReports() {
        List<SettlementBatch> batches = batchMapper.selectList(new LambdaQueryWrapper<SettlementBatch>()
                .orderByDesc(SettlementBatch::getId).last("LIMIT 100"));
        Map<Long, Product> products = productMapper.selectList(null).stream()
                .collect(Collectors.toMap(Product::getId, Function.identity(), (a, b) -> a));
        return Result.ok(batches.stream().map(b -> {
            Product p = products.get(b.getProductId());
            return new SettlementReportVO(b.getBatchNo(),
                    p == null ? null : p.getProductCode(),
                    p == null ? null : p.getProductName(),
                    b.getBatchDate() == null ? null : b.getBatchDate().toString(),
                    b.getPrincipalTotal() == null ? 0L : b.getPrincipalTotal(),
                    b.getIncomeTotal() == null ? 0L : b.getIncomeTotal(),
                    b.getStatus(),
                    b.getCreatedAt() == null ? null : b.getCreatedAt().toString());
        }).toList());
    }

    /** 对账任务列表 */
    @GetMapping("/recon/tasks")
    public Result<List<ReconTask>> reconTasks(@RequestParam(required = false, defaultValue = "30") int limit) {
        return Result.ok(reconService.tasks(limit));
    }

    /** 对账差异明细（taskId 为空取最新任务） */
    @GetMapping("/recon/diffs")
    public Result<List<ReconDiff>> reconDiffs(@RequestParam(required = false) Long taskId) {
        return Result.ok(reconService.diffs(taskId));
    }

    private LocalDate date(String s) {
        return s == null || s.isBlank() ? LocalDate.now() : LocalDate.parse(s);
    }
}
