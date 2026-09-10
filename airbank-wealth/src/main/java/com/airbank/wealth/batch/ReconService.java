package com.airbank.wealth.batch;

import com.airbank.api.core.CoreClient;
import com.airbank.api.core.dto.GlBalanceVO;
import com.airbank.common.api.Result;
import com.airbank.common.exception.BizException;
import com.airbank.common.exception.ErrorCodes;
import com.airbank.wealth.entity.Position;
import com.airbank.wealth.entity.Product;
import com.airbank.wealth.entity.ReconDiff;
import com.airbank.wealth.entity.ReconTask;
import com.airbank.wealth.mapper.PositionMapper;
import com.airbank.wealth.mapper.ProductMapper;
import com.airbank.wealth.mapper.ReconDiffMapper;
import com.airbank.wealth.mapper.ReconTaskMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 理财-核心对账（docs/design/04 §7）：
 * 核心 2061 科目余额 vs Σ持仓 cost_amount（产品 value_date ≤ batchDate，未清算持仓本金为 0 自然剔除）。
 * 差异落 t_recon_diff（BALANCE），v1 不自动调账，出报告供培训分析。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ReconService {

    public static final String SUBJECT_2061 = "2061";

    private final CoreClient coreClient;
    private final ProductMapper productMapper;
    private final PositionMapper positionMapper;
    private final ReconTaskMapper taskMapper;
    private final ReconDiffMapper diffMapper;
    private final StringRedisTemplate redis;

    public String trigger(LocalDate batchDate) {
        String lockKey = "lock:batch:RECON:" + batchDate;
        Boolean locked = redis.opsForValue().setIfAbsent(lockKey, "1", Duration.ofMinutes(30));
        if (!Boolean.TRUE.equals(locked)) {
            throw BizException.of(ErrorCodes.BATCH_RUNNING, "对账正在执行或锁占用中（30 分钟后自动释放）");
        }
        try {
            return run(batchDate);
        } finally {
            redis.delete(lockKey);
        }
    }

    private String run(LocalDate batchDate) {
        long gl = gl2061Balance(batchDate);
        long sum = positionPrincipalSum(batchDate);
        long diff = gl - sum;
        saveTask(batchDate, gl, sum, diff);
        String msg = "recon done: gl-2061=" + gl + ", positions=" + sum + ", diff=" + diff
                + (diff == 0 ? " (balanced)" : " (DIFF, 见 t_recon_diff，v1 不自动调账)");
        log.info("[recon] {} {}", batchDate, msg);
        return msg;
    }

    @Transactional
    public void saveTask(LocalDate batchDate, long gl, long sum, long diff) {
        ReconTask task = taskMapper.selectOne(new LambdaQueryWrapper<ReconTask>()
                .eq(ReconTask::getBatchDate, batchDate));
        boolean create = task == null;
        if (create) {
            task = new ReconTask();
            task.setBatchDate(batchDate);
            task.setCreatedAt(LocalDateTime.now());
        }
        task.setGl2061Balance(gl);
        task.setPositionPrincipalSum(sum);
        task.setDiff(diff);
        task.setStatus(diff == 0 ? ReconTask.ST_DONE : ReconTask.ST_DIFF);
        if (create) {
            taskMapper.insert(task);
        } else {
            taskMapper.updateById(task);
            diffMapper.delete(new LambdaQueryWrapper<ReconDiff>().eq(ReconDiff::getTaskId, task.getId()));
        }
        if (diff != 0) {
            ReconDiff d = new ReconDiff();
            d.setTaskId(task.getId());
            d.setDiffType(ReconDiff.TYPE_BALANCE);
            d.setBizKey(SUBJECT_2061);
            d.setCoreAmount(gl);
            d.setWealthAmount(sum);
            d.setRemark("2061 代理理财资金总分差异，待人工分析（v1 不自动调账）");
            diffMapper.insert(d);
        }
    }

    /** 核心 2061 科目余额（日终批量生成的科目日结） */
    private long gl2061Balance(LocalDate batchDate) {
        Result<List<GlBalanceVO>> r;
        try {
            r = coreClient.glBalances(batchDate.toString());
        } catch (BizException e) {
            throw e;
        } catch (Exception e) {
            throw BizException.of(ErrorCodes.DOWNSTREAM_UNAVAILABLE,
                    "获取核心科目余额失败（核心日终批量是否已执行？）: " + e.getMessage());
        }
        List<GlBalanceVO> balances = r == null ? null : r.getData();
        if (balances == null || balances.isEmpty()) {
            throw BizException.of(ErrorCodes.DOWNSTREAM_UNAVAILABLE,
                    "核心无 " + batchDate + " 科目日结数据，请先执行核心日终批量");
        }
        return balances.stream()
                .filter(g -> SUBJECT_2061.equals(g.subjectCode()))
                .mapToLong(GlBalanceVO::balance)
                .findFirst()
                .orElse(0L);
    }

    /** Σ持仓 cost_amount（成立日 ≤ batchDate 的产品；已清算持仓本金为 0 自然剔除） */
    private long positionPrincipalSum(LocalDate batchDate) {
        List<Long> productIds = productMapper.selectList(new LambdaQueryWrapper<Product>()
                        .le(Product::getValueDate, batchDate))
                .stream().map(Product::getId).toList();
        if (productIds.isEmpty()) {
            return 0L;
        }
        return positionMapper.selectList(new LambdaQueryWrapper<Position>()
                        .in(Position::getProductId, productIds)
                        .gt(Position::getCostAmount, 0))
                .stream().mapToLong(p -> p.getCostAmount() == null ? 0L : p.getCostAmount())
                .sum();
    }

    /** 对账报告：任务列表（新→旧） */
    public List<ReconTask> tasks(int limit) {
        return taskMapper.selectList(new LambdaQueryWrapper<ReconTask>()
                .orderByDesc(ReconTask::getBatchDate).last("LIMIT " + Math.min(Math.max(limit, 1), 100)));
    }

    /** 指定任务的差异明细；taskId 为空取最新任务 */
    public List<ReconDiff> diffs(Long taskId) {
        Long id = taskId;
        if (id == null) {
            ReconTask latest = taskMapper.selectOne(new LambdaQueryWrapper<ReconTask>()
                    .orderByDesc(ReconTask::getBatchDate).last("LIMIT 1"));
            if (latest == null) {
                return List.of();
            }
            id = latest.getId();
        }
        return diffMapper.selectList(new LambdaQueryWrapper<ReconDiff>().eq(ReconDiff::getTaskId, id));
    }
}
