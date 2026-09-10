package com.airbank.core.accounting;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

/**
 * 利息计算（docs/design/03 §5）：年利率/360 按实际天数，单利，四舍五入到分。
 */
public final class InterestCalc {

    private InterestCalc() {
    }

    /** 活期每日计提：余额 × 年利率 / 360 */
    public static long demandAccrual(long balance, BigDecimal annualRate) {
        if (balance <= 0) {
            return 0;
        }
        return BigDecimal.valueOf(balance).multiply(annualRate)
                .divide(BigDecimal.valueOf(360), 0, RoundingMode.HALF_UP).longValue();
    }

    /** 定期到期利息：本金 × 年利率 × 期限月数 / 12（对月对日，30/360 等价） */
    public static long timeInterest(long principal, BigDecimal annualRate, int termMonths) {
        return BigDecimal.valueOf(principal).multiply(annualRate)
                .multiply(BigDecimal.valueOf(termMonths))
                .divide(BigDecimal.valueOf(12), 0, RoundingMode.HALF_UP).longValue();
    }

    /** 定期提前支取利息：本金 × 活期利率 × 实际天数 / 360 */
    public static long earlyBreakInterest(long principal, BigDecimal demandRate, LocalDate valueDate, LocalDate breakDate) {
        long days = Math.max(1, ChronoUnit.DAYS.between(valueDate, breakDate));
        return BigDecimal.valueOf(principal).multiply(demandRate)
                .multiply(BigDecimal.valueOf(days))
                .divide(BigDecimal.valueOf(360), 0, RoundingMode.HALF_UP).longValue();
    }
}
