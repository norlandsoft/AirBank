package com.airbank.wealth.model;

/**
 * 持仓收益明细（GET /positions/{id}/incomes）。
 */
public record IncomeVO(
        String batchDate,
        long income,
        String rate
) {
}
