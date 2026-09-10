package com.airbank.wealth.batch;

import com.airbank.common.exception.BizException;
import com.airbank.common.exception.ErrorCodes;
import com.airbank.wealth.entity.IncomeRecord;
import com.airbank.wealth.entity.Position;
import com.airbank.wealth.entity.Product;
import com.airbank.wealth.mapper.IncomeRecordMapper;
import com.airbank.wealth.mapper.PositionMapper;
import com.airbank.wealth.mapper.ProductMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDate;
import java.util.List;

/**
 * 每日收益计提（docs/design/04 §4）：
 * RUNNING 产品每持仓 daily = cost_amount × annual_rate ÷ 360（分，四舍五入），
 * 写 t_income_record（按持仓按日唯一）并累加 accruing_income。只计提不付账。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AccrualService {

    private static final BigDecimal DAYS_360 = BigDecimal.valueOf(360);

    private final ProductMapper productMapper;
    private final PositionMapper positionMapper;
    private final IncomeRecordMapper incomeRecordMapper;
    private final StringRedisTemplate redis;

    @Scheduled(cron = "${airbank.params.accrual-cron:0 45 23 * * ?}")
    public void scheduled() {
        try {
            trigger(LocalDate.now());
        } catch (Exception e) {
            log.warn("[accrual] scheduled failed: {}", e.getMessage());
        }
    }

    /** 手动/内部触发入口 */
    public String trigger(LocalDate batchDate) {
        String lockKey = "lock:batch:ACCRUAL:" + batchDate;
        Boolean locked = redis.opsForValue().setIfAbsent(lockKey, "1", Duration.ofMinutes(30));
        if (!Boolean.TRUE.equals(locked)) {
            throw BizException.of(ErrorCodes.BATCH_RUNNING, "计提批量正在执行或锁占用中（30 分钟后自动释放）");
        }
        try {
            return run(batchDate);
        } finally {
            redis.delete(lockKey);
        }
    }

    private String run(LocalDate batchDate) {
        int n = accrue(batchDate);
        String msg = "accrual done: positions=" + n;
        log.info("[accrual] {} {}", batchDate, msg);
        return msg;
    }

    /** 幂等键 (position_id, batch_date)：已计提跳过 */
    @Transactional
    public int accrue(LocalDate batchDate) {
        List<Product> running = productMapper.selectList(new LambdaQueryWrapper<Product>()
                .eq(Product::getStatus, Product.ST_RUNNING));
        int n = 0;
        for (Product p : running) {
            List<Position> positions = positionMapper.selectList(new LambdaQueryWrapper<Position>()
                    .eq(Position::getProductId, p.getId())
                    .gt(Position::getTotalShares, BigDecimal.ZERO));
            for (Position pos : positions) {
                boolean exists = incomeRecordMapper.selectCount(new LambdaQueryWrapper<IncomeRecord>()
                        .eq(IncomeRecord::getPositionId, pos.getId())
                        .eq(IncomeRecord::getBatchDate, batchDate)) > 0;
                if (exists) {
                    continue;
                }
                long income = BigDecimal.valueOf(pos.getCostAmount())
                        .multiply(p.getAnnualRate())
                        .divide(DAYS_360, 0, RoundingMode.HALF_UP)
                        .longValue();
                IncomeRecord rec = new IncomeRecord();
                rec.setPositionId(pos.getId());
                rec.setBatchDate(batchDate);
                rec.setIncome(income);
                rec.setRate(p.getAnnualRate());
                incomeRecordMapper.insert(rec);
                positionMapper.update(null, new LambdaUpdateWrapper<Position>()
                        .eq(Position::getId, pos.getId())
                        .setSql("accruing_income = accruing_income + " + income));
                n++;
            }
        }
        return n;
    }
}
