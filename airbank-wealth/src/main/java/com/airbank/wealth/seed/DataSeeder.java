package com.airbank.wealth.seed;

import com.airbank.wealth.entity.Product;
import com.airbank.wealth.mapper.ProductMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 种子产品（幂等，存在即跳过）：
 * WB001 稳盈90天90期  90天 R1 2.60% 起购1,000元 步长1,000元 单笔上限500万 募集上限5亿
 * WB002 稳利365第12期 365天 R2 3.05% 起购10,000元
 * WB003 进取半年开6号 180天 R3 3.80% 起购10,000元
 * 募集期 = 今天-7 ~ 今天-1；成立日（起息/确认日）= 明天（T+1）；状态 ON_SALE。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DataSeeder implements ApplicationRunner {

    private final ProductMapper productMapper;

    @Override
    public void run(ApplicationArguments args) {
        if (productMapper.selectCount(null) > 0) {
            return;
        }
        LocalDate today = LocalDate.now();
        LocalDate raiseStart = today.minusDays(7);
        LocalDate raiseEnd = today.minusDays(1);
        LocalDate valueDate = today.plusDays(1);

        create("WB001", "稳盈90天90期", 90, "0.0260", "R1",
                100_000L, 100_000L, 500_000_000L, 50_000_000_000L,
                raiseStart, raiseEnd, valueDate);
        create("WB002", "稳利365第12期", 365, "0.0305", "R2",
                1_000_000L, 100_000L, 500_000_000L, 50_000_000_000L,
                raiseStart, raiseEnd, valueDate);
        create("WB003", "进取半年开6号", 180, "0.0380", "R3",
                1_000_000L, 100_000L, 500_000_000L, 50_000_000_000L,
                raiseStart, raiseEnd, valueDate);
        log.info("[seed] wealth products ready: WB001/WB002/WB003 on-sale, value-date {}", valueDate);
    }

    private void create(String code, String name, int termDays, String rate, String risk,
                        long minAmount, long stepAmount, long maxSingle, long raiseLimit,
                        LocalDate raiseStart, LocalDate raiseEnd, LocalDate valueDate) {
        if (productMapper.selectCount(new LambdaQueryWrapper<Product>()
                .eq(Product::getProductCode, code)) > 0) {
            return;
        }
        Product p = new Product();
        p.setProductCode(code);
        p.setProductName(name);
        p.setTermDays(termDays);
        p.setAnnualRate(new BigDecimal(rate));
        p.setRiskLevel(risk);
        p.setMinAmount(minAmount);
        p.setStepAmount(stepAmount);
        p.setMaxSingleAmount(maxSingle);
        p.setRaiseLimit(raiseLimit);
        p.setRaisedAmount(0L);
        p.setRaiseStartDate(raiseStart);
        p.setRaiseEndDate(raiseEnd);
        p.setValueDate(valueDate);
        p.setMaturityDate(valueDate.plusDays(termDays));
        p.setStatus(Product.ST_ON_SALE);
        p.setRedeemFeeRate(BigDecimal.ZERO);
        productMapper.insert(p);
        log.info("[seed] product {} {} {} {} {}% on-sale", code, name, termDays + "天", risk,
                new BigDecimal(rate).multiply(BigDecimal.valueOf(100)).stripTrailingZeros().toPlainString());
    }
}
