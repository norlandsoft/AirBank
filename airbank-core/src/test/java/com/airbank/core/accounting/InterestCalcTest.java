package com.airbank.core.accounting;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

class InterestCalcTest {

    @Test
    void demandAccrualShouldRoundHalfUp() {
        // ¥100,000 × 0.30% / 360 = ¥0.8333 → 83 分
        assertThat(InterestCalc.demandAccrual(10_000_000L, new BigDecimal("0.0030"))).isEqualTo(83L);
        // 零余额不计提
        assertThat(InterestCalc.demandAccrual(0L, new BigDecimal("0.0030"))).isZero();
        assertThat(InterestCalc.demandAccrual(-1L, new BigDecimal("0.0030"))).isZero();
    }

    @Test
    void timeInterestShouldFollowMonthsBasis() {
        // ¥20,000 × 1.55% × 12/12 = ¥310
        assertThat(InterestCalc.timeInterest(2_000_000L, new BigDecimal("0.0155"), 12)).isEqualTo(31_000L);
        // ¥1,000 × 1.15% × 3/12 = ¥2.875 → 288 分（HALF_UP）
        assertThat(InterestCalc.timeInterest(100_000L, new BigDecimal("0.0115"), 3)).isEqualTo(288L);
    }

    @Test
    void earlyBreakShouldUseDemandRateAndActualDays() {
        // ¥10,000 × 0.30% × 10/360 = ¥0.8333 → 83 分
        long v = InterestCalc.earlyBreakInterest(1_000_000L, new BigDecimal("0.0030"),
                LocalDate.of(2026, 1, 1), LocalDate.of(2026, 1, 11));
        assertThat(v).isEqualTo(83L);
        // 起息当日支取按 1 天
        long one = InterestCalc.earlyBreakInterest(1_000_000L, new BigDecimal("0.0030"),
                LocalDate.of(2026, 1, 1), LocalDate.of(2026, 1, 1));
        assertThat(one).isEqualTo(8L);
    }
}
