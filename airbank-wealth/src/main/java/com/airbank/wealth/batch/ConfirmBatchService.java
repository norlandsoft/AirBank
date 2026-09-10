package com.airbank.wealth.batch;

import com.airbank.common.exception.BizException;
import com.airbank.common.exception.ErrorCodes;
import com.airbank.wealth.entity.Position;
import com.airbank.wealth.entity.Product;
import com.airbank.wealth.entity.WealthOrder;
import com.airbank.wealth.mapper.PositionMapper;
import com.airbank.wealth.mapper.ProductMapper;
import com.airbank.wealth.mapper.WealthOrderMapper;
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
 * T+1 确认批量（docs/design/04 §2）：
 * 1) PAY_SUCCESS 且 confirm_date ≤ batchDate 的订单 → 生成份额（1 元 = 1 份）→ CONFIRMED，持仓 upsert；
 * 2) 产品 value_date ≤ batchDate 且状态 ∈ (ON_SALE/OFF_SALE/SOLD_OUT) → RUNNING（成立起息）。
 * Redis 锁防并发；步骤幂等可重跑。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ConfirmBatchService {

    private final WealthOrderMapper orderMapper;
    private final ProductMapper productMapper;
    private final PositionMapper positionMapper;
    private final StringRedisTemplate redis;

    @Scheduled(cron = "${airbank.params.confirm-cron:0 40 23 * * ?}")
    public void scheduled() {
        try {
            trigger(LocalDate.now());
        } catch (Exception e) {
            log.warn("[confirm] scheduled failed: {}", e.getMessage());
        }
    }

    /** 手动/内部触发入口 */
    public String trigger(LocalDate batchDate) {
        String lockKey = "lock:batch:CONFIRM:" + batchDate;
        Boolean locked = redis.opsForValue().setIfAbsent(lockKey, "1", Duration.ofMinutes(30));
        if (!Boolean.TRUE.equals(locked)) {
            throw BizException.of(ErrorCodes.BATCH_RUNNING, "确认批量正在执行或锁占用中（30 分钟后自动释放）");
        }
        try {
            return run(batchDate);
        } finally {
            redis.delete(lockKey);
        }
    }

    private String run(LocalDate batchDate) {
        int confirmed = confirmOrders(batchDate);
        int running = promoteProducts(batchDate);
        String msg = "confirm done: orders=" + confirmed + ", products-running=" + running;
        log.info("[confirm] {} {}", batchDate, msg);
        return msg;
    }

    /** PAY_SUCCESS → CONFIRMED + 持仓 upsert（幂等：仅处理 PAY_SUCCESS，重跑自然跳过已确认） */
    @Transactional
    public int confirmOrders(LocalDate batchDate) {
        List<WealthOrder> orders = orderMapper.selectList(new LambdaQueryWrapper<WealthOrder>()
                .eq(WealthOrder::getStatus, WealthOrder.ST_PAY_SUCCESS)
                .le(WealthOrder::getConfirmDate, batchDate));
        int n = 0;
        for (WealthOrder o : orders) {
            // 份额 = 金额(分) / 100，2 位小数（1.00 元 = 1.00 份）
            BigDecimal shares = BigDecimal.valueOf(o.getAmount()).movePointLeft(2).setScale(2, RoundingMode.HALF_UP);
            o.setShares(shares);
            o.setStatus(WealthOrder.ST_CONFIRMED);
            orderMapper.updateById(o);
            upsertPosition(o, shares, batchDate);
            n++;
            log.info("[confirm] order {} confirmed, shares={}", o.getOrderNo(), shares.toPlainString());
        }
        return n;
    }

    private void upsertPosition(WealthOrder o, BigDecimal shares, LocalDate batchDate) {
        Position pos = positionMapper.selectOne(new LambdaQueryWrapper<Position>()
                .eq(Position::getCustomerId, o.getCustomerId())
                .eq(Position::getProductId, o.getProductId()));
        if (pos == null) {
            pos = new Position();
            pos.setCustomerId(o.getCustomerId());
            pos.setProductId(o.getProductId());
            pos.setProductCode(o.getProductCode());
            pos.setAcctNo(o.getAcctNo());
            pos.setTotalShares(shares);
            pos.setFrozenShares(BigDecimal.ZERO);
            pos.setCostAmount(o.getAmount());
            pos.setAccruingIncome(0L);
            pos.setPaidIncome(0L);
            pos.setFirstBuyDate(batchDate);
            positionMapper.insert(pos);
        } else {
            positionMapper.update(null, new LambdaUpdateWrapper<Position>()
                    .eq(Position::getId, pos.getId())
                    .setSql("total_shares = total_shares + " + shares.toPlainString())
                    .setSql("cost_amount = cost_amount + " + o.getAmount()));
        }
    }

    /** 产品成立：value_date ≤ batchDate 且待成立状态 → RUNNING */
    @Transactional
    public int promoteProducts(LocalDate batchDate) {
        List<Product> ps = productMapper.selectList(new LambdaQueryWrapper<Product>()
                .le(Product::getValueDate, batchDate)
                .in(Product::getStatus, List.of(Product.ST_ON_SALE, Product.ST_OFF_SALE, Product.ST_SOLD_OUT)));
        for (Product p : ps) {
            p.setStatus(Product.ST_RUNNING);
            productMapper.updateById(p);
            log.info("[confirm] product {} value-date {} → RUNNING", p.getProductCode(), p.getValueDate());
        }
        return ps.size();
    }
}
