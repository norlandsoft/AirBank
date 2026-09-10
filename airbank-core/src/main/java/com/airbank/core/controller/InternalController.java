package com.airbank.core.controller;

import com.airbank.api.core.dto.BatchVO;
import com.airbank.api.core.dto.GlBalanceVO;
import com.airbank.common.api.Result;
import com.airbank.core.batch.DayEndBatchService;
import com.airbank.core.entity.BatchTask;
import com.airbank.core.entity.GlBalance;
import com.airbank.core.entity.GlSubject;
import com.airbank.core.mapper.BatchTaskMapper;
import com.airbank.core.mapper.GlBalanceMapper;
import com.airbank.core.mapper.GlSubjectMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

/**
 * 服务间内部契约（/internal/**，docs/design/07 §6.2）。
 */
@RestController
@RequestMapping("/internal")
@RequiredArgsConstructor
public class InternalController {

    private final DayEndBatchService dayEndBatchService;
    private final BatchTaskMapper taskMapper;
    private final GlBalanceMapper glBalanceMapper;
    private final GlSubjectMapper subjectMapper;

    @PostMapping("/batch/day-end/trigger")
    public Result<BatchVO> triggerDayEnd(@RequestParam(required = false) String batchDate) {
        BatchTask task = dayEndBatchService.trigger(batchDate == null ? LocalDate.now() : LocalDate.parse(batchDate));
        return Result.ok(new BatchVO(task.getId(), task.getBatchType(),
                task.getBatchDate() == null ? null : task.getBatchDate().toString(), task.getStatus(),
                task.getCurrentStep() == null ? null : "step-" + task.getCurrentStep(),
                task.getStartedAt() == null ? null : task.getStartedAt().toString(),
                task.getFinishedAt() == null ? null : task.getFinishedAt().toString()));
    }

    @GetMapping("/batch/tasks/{id}")
    public Result<BatchVO> task(@PathVariable Long id) {
        BatchTask t = taskMapper.selectById(id);
        return Result.ok(new BatchVO(t.getId(), t.getBatchType(),
                t.getBatchDate() == null ? null : t.getBatchDate().toString(), t.getStatus(),
                t.getCurrentStep() == null ? null : "step-" + t.getCurrentStep(),
                t.getStartedAt() == null ? null : t.getStartedAt().toString(),
                t.getFinishedAt() == null ? null : t.getFinishedAt().toString()));
    }

    @GetMapping("/gl/balances")
    public Result<List<GlBalanceVO>> glBalances(@RequestParam String batchDate) {
        LocalDate date = LocalDate.parse(batchDate);
        List<GlBalance> gls = glBalanceMapper.selectList(
                new LambdaQueryWrapper<GlBalance>().eq(GlBalance::getBatchDate, date));
        List<GlBalanceVO> list = gls.stream().map(g -> {
            GlSubject s = subjectMapper.selectById(g.getSubjectCode());
            return new GlBalanceVO(batchDate, g.getSubjectCode(), s == null ? "" : s.getSubjectName(),
                    g.getDrSum(), g.getCrSum(), g.getBalance());
        }).toList();
        return Result.ok(list);
    }
}
