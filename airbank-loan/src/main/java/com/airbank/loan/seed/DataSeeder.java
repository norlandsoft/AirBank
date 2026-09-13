package com.airbank.loan.seed;

import com.airbank.loan.entity.LoanProduct;
import com.airbank.loan.mapper.LoanProductMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

/**
 * 种子贷款产品（幂等，存在即跳过，docs/design/13 §2）：
 * LN001 极速信用贷  7.20% 1,000~200,000 元 3/6/12/24/36 期 准入分 560
 * LN002 消费分期贷  9.60%   500~ 50,000 元 3/6/12/24 期    准入分 550
 * LN003 经营周转贷  6.80% 10,000~500,000 元 6/12/24/36 期   准入分 620
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DataSeeder implements ApplicationRunner {

    private final LoanProductMapper productMapper;

    @Override
    public void run(ApplicationArguments args) {
        create("LN001", "极速信用贷", "凭信用线上秒批的小额信用贷款，随借随还（等额本息按月还款）。",
                100_000L, 20_000_000L, "3,6,12,24,36", "0.0720", 560);
        create("LN002", "消费分期贷", "面向消费场景的小额分期贷款，期限灵活，线上极速到账。",
                50_000L, 5_000_000L, "3,6,12,24", "0.0960", 550);
        create("LN003", "经营周转贷", "面向小微经营者的周转贷款，额度更高，利率优惠。",
                1_000_000L, 50_000_000L, "6,12,24,36", "0.0680", 620);
        log.info("[seed] loan products ready: LN001/LN002/LN003");
    }

    private void create(String code, String name, String desc, long minAmount, long maxAmount,
                        String termOptions, String rate, int minScore) {
        if (productMapper.selectCount(new LambdaQueryWrapper<LoanProduct>()
                .eq(LoanProduct::getProductCode, code)) > 0) {
            return;
        }
        LoanProduct p = new LoanProduct();
        p.setProductCode(code);
        p.setProductName(name);
        p.setDescription(desc);
        p.setMinAmount(minAmount);
        p.setMaxAmount(maxAmount);
        p.setTermOptions(termOptions);
        p.setAnnualRate(new BigDecimal(rate));
        p.setRepayMethod(LoanProduct.REPAY_EQUAL_INSTALLMENT);
        p.setMinScore(minScore);
        p.setStatus(LoanProduct.ST_ON_SALE);
        productMapper.insert(p);
        log.info("[seed] loan product {} {} {}% on-sale", code, name,
                new BigDecimal(rate).multiply(BigDecimal.valueOf(100)).stripTrailingZeros().toPlainString());
    }
}
