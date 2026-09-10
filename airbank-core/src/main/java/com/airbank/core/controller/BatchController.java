package com.airbank.core.controller;

import com.airbank.api.core.dto.BatchVO;
import com.airbank.api.core.dto.GlBalanceVO;
import com.airbank.api.core.dto.ReconReportVO;
import com.airbank.common.api.Result;
import com.airbank.core.batch.DayEndBatchService;
import com.airbank.core.entity.BatchTask;
import com.airbank.core.entity.GlBalance;
import com.airbank.core.entity.GlSubject;
import com.airbank.core.mapper.BatchStepLogMapper;
import com.airbank.core.mapper.BatchTaskMapper;
import com.airbank.core.mapper.GlBalanceMapper;
import com.airbank.core.mapper.GlSubjectMapper;
import com.airbank.core.mapper.ReportMapper;
import com.airbank.core.service.InterestService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/batch")
@RequiredArgsConstructor
public class BatchController {

    private final DayEndBatchService dayEndBatchService;
    private final BatchTaskMapper taskMapper;
    private final BatchStepLogMapper stepMapper;
    private final GlBalanceMapper glBalanceMapper;
    private final GlSubjectMapper subjectMapper;
    private final ReportMapper reportMapper;
    private final InterestService interestService;

    /** 手动触发日终（培训可随时快进日切） */
    @PostMapping("/day-end/trigger")
    public Result<BatchVO> triggerDayEnd(@RequestParam(required = false) String batchDate) {
        BatchTask task = dayEndBatchService.trigger(batchDate == null ? LocalDate.now() : LocalDate.parse(batchDate));
        return Result.ok(toVo(task));
    }

    @GetMapping("/tasks")
    public Result<List<BatchVO>> tasks() {
        return Result.ok(taskMapper.selectList(new LambdaQueryWrapper<BatchTask>()
                        .orderByDesc(BatchTask::getId).last("LIMIT 50"))
                .stream().map(this::toVo).toList());
    }

    @GetMapping("/tasks/{id}")
    public Result<BatchVO> task(@PathVariable Long id) {
        return Result.ok(toVo(taskMapper.selectById(id)));
    }

    @GetMapping("/tasks/{id}/steps")
    public Result<List<Map<String, Object>>> steps(@PathVariable Long id) {
        return Result.ok(stepMapper.selectList(new LambdaQueryWrapper<com.airbank.core.entity.BatchStepLog>()
                        .eq(com.airbank.core.entity.BatchStepLog::getTaskId, id)
                        .orderByAsc(com.airbank.core.entity.BatchStepLog::getStepNo))
                .stream().<Map<String, Object>>map(s -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("stepNo", s.getStepNo());
                    m.put("stepName", s.getStepName());
                    m.put("rows", s.getRows());
                    m.put("status", s.getStatus());
                    m.put("message", s.getMessage());
                    m.put("costMs", s.getCostMs());
                    return m;
                }).toList());
    }

    @GetMapping("/recon-report")
    public Result<ReconReportVO> reconReport(@RequestParam(required = false) String batchDate) {
        return Result.ok(dayEndBatchService.reconReport(
                batchDate == null ? LocalDate.now() : LocalDate.parse(batchDate)));
    }

    @GetMapping("/daily-report")
    public Result<Map<String, Object>> dailyReport(@RequestParam(required = false) String batchDate) {
        LocalDate date = batchDate == null ? LocalDate.now() : LocalDate.parse(batchDate);
        Map<String, Object> report = new LinkedHashMap<>();
        report.put("batchDate", date.toString());
        report.put("byChannel", reportMapper.txnSumByChannel(date));
        report.put("cashIn", reportMapper.counterCashIn(date));
        report.put("cashOut", reportMapper.counterCashOut(date));
        List<GlBalance> gls = glBalanceMapper.selectList(
                new LambdaQueryWrapper<GlBalance>().eq(GlBalance::getBatchDate, date));
        Map<String, Long> subjectBalance = new LinkedHashMap<>();
        for (GlBalance g : gls) {
            GlSubject s = subjectMapper.selectById(g.getSubjectCode());
            subjectBalance.put(g.getSubjectCode() + " " + (s == null ? "" : s.getSubjectName()), g.getBalance());
        }
        report.put("subjectBalances", subjectBalance);
        return Result.ok(report);
    }

    /** 手动结息（演示/应急） */
    @PostMapping("/settle-interest")
    public Result<Integer> settleInterest(@RequestParam(required = false) String batchDate) {
        return Result.ok(interestService.settle(
                batchDate == null ? LocalDate.now() : LocalDate.parse(batchDate), true));
    }

    private BatchVO toVo(BatchTask t) {
        return new BatchVO(t.getId(), t.getBatchType(), t.getBatchDate() == null ? null : t.getBatchDate().toString(),
                t.getStatus(), t.getCurrentStep() == null ? null : "step-" + t.getCurrentStep(),
                t.getStartedAt() == null ? null : t.getStartedAt().toString(),
                t.getFinishedAt() == null ? null : t.getFinishedAt().toString());
    }
}
