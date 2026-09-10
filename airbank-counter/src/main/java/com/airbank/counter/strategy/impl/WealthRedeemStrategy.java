package com.airbank.counter.strategy.impl;

import com.airbank.api.wealth.WealthClient;
import com.airbank.api.wealth.dto.OrderVO;
import com.airbank.api.wealth.dto.RedeemCmd;
import com.airbank.common.api.Result;
import com.airbank.common.exception.BizException;
import com.airbank.common.exception.ErrorCodes;
import com.airbank.counter.entity.CounterTxn;
import com.airbank.counter.strategy.BizTypeStrategy;
import com.airbank.counter.strategy.ExecContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 理财赎回：shares（份×100）与金额"分"同刻度，直接取 amount（docs/design/04）。
 */
@Component
@RequiredArgsConstructor
public class WealthRedeemStrategy implements BizTypeStrategy {

    private final WealthClient wealthClient;

    @Override
    public List<String> bizTypes() {
        return List.of(CounterTxn.BIZ_WEALTH_REDEEM);
    }

    @Override
    public Map<String, Object> execute(ExecContext ctx) {
        Long customerId = ctx.longVal("customerId");
        if (customerId == null) {
            throw BizException.of(ErrorCodes.PARAM_INVALID, "缺少 customerId");
        }
        Result<OrderVO> r = wealthClient.redeem(new RedeemCmd(
                ctx.requestNo(), customerId, ctx.str("acctNo"), ctx.str("productCode"),
                ctx.amount(), "COUNTER", ctx.tellerNo()));
        OrderVO o = r == null ? null : r.getData();
        if (o == null) {
            throw BizException.of(ErrorCodes.DOWNSTREAM_UNAVAILABLE, "理财赎回无返回");
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("orderNo", o.orderNo());
        result.put("productCode", o.productCode());
        result.put("productName", o.productName());
        result.put("shares", o.shares());
        result.put("amount", o.amount());
        result.put("status", o.status());
        return result;
    }
}
