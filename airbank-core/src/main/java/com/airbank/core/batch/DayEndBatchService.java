package com.airbank.core.batch;

import com.airbank.api.core.dto.ReconReportVO;
import com.airbank.common.exception.BizException;
import com.airbank.common.exception.ErrorCodes;
import com.airbank.core.entity.Account;
import com.airbank.core.entity.BatchStepLog;
import com.airbank.core.entity.BatchTask;
import com.airbank.core.entity.GlBalance;
import com.airbank.core.entity.GlSubject;
import com.airbank.core.mapper.AccountMapper;
import com.airbank.core.mapper.BatchStepLogMapper;
import com.airbank.core.mapper.BatchTaskMapper;
import com.airbank.core.mapper.GlBalanceMapper;
import com.airbank.core.mapper.GlSubjectMapper;
import com.airbank.core.mapper.ReportMapper;
import com.airbank.core.service.InterestService;
import com.airbank.core.service.TimeDepositService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 日终批量（docs/design/03 §8）：日切→计提→定期兑付→结息→科目日结→总分核对→报表。
 * Redis 分布式锁防并发；步骤幂等可断点重跑。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DayEndBatchService {

    private final BatchTaskMapper taskMapper;
    private final BatchStepLogMapper stepMapper;
    private final InterestService interestService;
    private final TimeDepositService timeDepositService;
    private final AccountMapper accountMapper;
    private final GlSubjectMapper subjectMapper;
    private final GlBalanceMapper glBalanceMapper;
    private final ReportMapper reportMapper;
    private final com.airbank.core.mapper.TimeDepositMapper timeDepositMapper;
    private final StringRedisTemplate redis;

    /** 定时日终（cron 可配） */
    @Scheduled(cron = "${airbank.params.batch-cron:0 35 23 * * ?}")
    public void scheduled() {
        try {
            trigger(LocalDate.now());
        } catch (Exception e) {
            log.warn("[batch] scheduled day-end failed: {}", e.getMessage());
        }
    }

    /** 手动/定时触发入口 */
    public BatchTask trigger(LocalDate batchDate) {
        String lockKey = "lock:batch:DAY_END:" + batchDate;
        Boolean locked = redis.opsForValue().setIfAbsent(lockKey, "1", Duration.ofMinutes(30));
        if (!Boolean.TRUE.equals(locked)) {
            BatchTask running = taskMapper.selectOne(new LambdaQueryWrapper<BatchTask>()
                    .eq(BatchTask::getBatchType, BatchTask.TYPE_DAY_END)
                    .eq(BatchTask::getBatchDate, batchDate));
            if (running != null && BatchTask.ST_RUNNING.equals(running.getStatus())) {
                throw BizException.of(ErrorCodes.BATCH_RUNNING, "日终批量正在执行，请稍后");
            }
            throw BizException.of(ErrorCodes.BATCH_RUNNING, "批量锁占用中（可能上次异常退出，30 分钟后自动释放）");
        }
        try {
            return run(batchDate);
        } finally {
            redis.delete(lockKey);
        }
    }

    private BatchTask run(LocalDate batchDate) {
        BatchTask exist = taskMapper.selectOne(new LambdaQueryWrapper<BatchTask>()
                .eq(BatchTask::getBatchType, BatchTask.TYPE_DAY_END)
                .eq(BatchTask::getBatchDate, batchDate));
        if (exist != null && BatchTask.ST_SUCCESS.equals(exist.getStatus())) {
            return exist; // 幂等：已完成直接返回
        }
        BatchTask task = exist == null ? new BatchTask() : exist;
        task.setBatchType(BatchTask.TYPE_DAY_END);
        task.setBatchDate(batchDate);
        task.setStatus(BatchTask.ST_RUNNING);
        task.setCurrentStep(0);
        task.setStartedAt(LocalDateTime.now());
        task.setFinishedAt(null);
        if (exist == null) {
            taskMapper.insert(task);
        } else {
            taskMapper.updateById(task);
        }
        try {
            step(task, 1, "活期利息计提", () -> interestService.accrue(batchDate));
            step(task, 2, "定期到期兑付", () -> timeDepositService.matureDue(batchDate));
            step(task, 3, "活期结息(季末)", () -> interestService.settle(batchDate, false));
            step(task, 4, "科目日结汇总", () -> glSummary(batchDate));
            step(task, 5, "总分核对", () -> {
                ReconReportVO r = reconReport(batchDate);
                return r.balanced() ? 1 : -1;
            });
            task.setStatus(BatchTask.ST_SUCCESS);
            task.setFinishedAt(LocalDateTime.now());
            taskMapper.updateById(task);
            log.info("[batch] day-end {} finished", batchDate);
            return task;
        } catch (Exception e) {
            task.setStatus(BatchTask.ST_FAILED);
            task.setFinishedAt(LocalDateTime.now());
            taskMapper.updateById(task);
            log.error("[batch] day-end {} failed at step {}", batchDate, task.getCurrentStep(), e);
            throw new IllegalStateException("日终批量失败于步骤 " + task.getCurrentStep() + ": " + e.getMessage(), e);
        }
    }

    private void step(BatchTask task, int stepNo, String name, StepBody body) {
        long start = System.currentTimeMillis();
        task.setCurrentStep(stepNo);
        taskMapper.updateById(task);
        BatchStepLog s = new BatchStepLog();
        s.setTaskId(task.getId());
        s.setStepNo(stepNo);
        s.setStepName(name);
        try {
            int rows = body.run();
            s.setRows(rows);
            s.setStatus(rows < 0 ? "WARN" : "SUCCESS");
            s.setMessage(rows < 0 ? "总分核对不平衡（差 1 分以上），详见核对报告" : null);
        } catch (BizException e) {
            s.setStatus("FAILED");
            s.setMessage(e.getMessage());
            saveStep(s, start);
            throw e;
        } catch (Exception e) {
            s.setStatus("FAILED");
            s.setMessage(e.getMessage());
            saveStep(s, start);
            throw e;
        }
        saveStep(s, start);
    }

    @FunctionalInterface
    private interface StepBody {
        int run();
    }

    private void saveStep(BatchStepLog s, long start) {
        s.setCostMs(System.currentTimeMillis() - start);
        if (s.getMessage() != null && s.getMessage().length() > 450) {
            s.setMessage(s.getMessage().substring(0, 450));
        }
        stepMapper.insert(s);
    }

    /** 科目日结：删除当日后重算（幂等） */
    public int glSummary(LocalDate batchDate) {
        glBalanceMapper.delete(new LambdaQueryWrapper<GlBalance>().eq(GlBalance::getBatchDate, batchDate));
        List<Map<String, Object>> sums = reportMapper.journalSumBySubject(batchDate);
        for (Map<String, Object> sum : sums) {
            GlBalance gb = new GlBalance();
            gb.setBatchDate(batchDate);
            gb.setSubjectCode((String) sum.get("subjectCode"));
            long dr = ((Number) sum.get("drSum")).longValue();
            long cr = ((Number) sum.get("crSum")).longValue();
            gb.setDrSum(dr);
            gb.setCrSum(cr);
            GlSubject subj = subjectMapper.selectById(gb.getSubjectCode());
            String direction = subj == null ? "CR" : subj.getDirection();
            gb.setBalance("DR".equals(direction) ? dr - cr : cr - dr);
            glBalanceMapper.insert(gb);
        }
        return sums.size();
    }

    /** 总分核对：Σ明细账户余额 vs 科目汇总（优先取当日 gl_balance，无则实时汇总分录） */
    public ReconReportVO reconReport(LocalDate batchDate) {
        List<GlBalance> gls = glBalanceMapper.selectList(
                new LambdaQueryWrapper<GlBalance>().eq(GlBalance::getBatchDate, batchDate));
        long glDemand = gl(gls, "2011");
        long glTime = gl(gls, "2012");
        long detailDemand = accountMapper.selectList(new LambdaQueryWrapper<Account>()
                        .eq(Account::getSubjectCode, "2011").ne(Account::getStatus, "CLOSED"))
                .stream().mapToLong(Account::getBalance).sum();
        // 定期本金在存单（定期账户余额恒 0），以存单合计核对
        long depositSum = timeDepositSum(batchDate);
        long diff = Math.abs(glDemand - detailDemand) + Math.abs(glTime - depositSum);
        List<com.airbank.api.core.dto.GlBalanceVO> subjects = gls.stream().map(g -> {
            GlSubject sub = subjectMapper.selectById(g.getSubjectCode());
            return new com.airbank.api.core.dto.GlBalanceVO(batchDate.toString(), g.getSubjectCode(),
                    sub == null ? "" : sub.getSubjectName(), g.getDrSum(), g.getCrSum(), g.getBalance());
        }).toList();
        return new ReconReportVO(batchDate.toString(), diff == 0, glDemand, detailDemand, glTime, depositSum,
                diff, subjects);
    }

    private long gl(List<GlBalance> gls, String subject) {
        return gls.stream().filter(g -> subject.equals(g.getSubjectCode())).mapToLong(GlBalance::getBalance)
                .findFirst().orElse(0L);
    }

    /** 定期科目余额 = 未兑付存单本金合计（起息日 ≤ 核对日） */
    private long timeDepositSum(LocalDate batchDate) {
        return timeDepositMapper.selectList(new LambdaQueryWrapper<com.airbank.core.entity.TimeDeposit>()
                        .eq(com.airbank.core.entity.TimeDeposit::getStatus, com.airbank.core.entity.TimeDeposit.ST_HOLDING)
                        .le(com.airbank.core.entity.TimeDeposit::getValueDate, batchDate))
                .stream().mapToLong(com.airbank.core.entity.TimeDeposit::getAmount).sum();
    }
}
