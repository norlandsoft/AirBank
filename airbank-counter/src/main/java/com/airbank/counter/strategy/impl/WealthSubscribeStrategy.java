package com.airbank.counter.strategy.impl;

import com.airbank.api.wealth.WealthClient;
import com.airbank.api.wealth.dto.OrderVO;
import com.airbank.api.wealth.dto.SubscribeCmd;
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
 * 理财申购（下单即扣款，T+1 确认份额）。
 */
@Component
@RequiredArgsConstructor
public class WealthSubscribeStrategy implements BizTypeStrategy {

    private final WealthClient wealthClient;

    @Override
    public List<String> bizTypes() {
        return List.of(CounterTxn.BIZ_WEALTH_SUBSCRIBE);
    }

    @Override
    public Map<String, Object> execute(ExecContext ctx) {
        Long customerId = ctx.longVal("customerId");
        if (customerId == null) {
            throw BizException.of(ErrorCodes.PARAM_INVALID, "缺少 customerId");
        }
        Result<OrderVO> r = wealthClient.subscribe(new SubscribeCmd(
                ctx.requestNo(), customerId, ctx.str("acctNo"), ctx.str("productCode"),
                ctx.amount(), "COUNTER", ctx.tellerNo()));
        OrderVO o = r == null ? null : r.getData();
        if (o == null) {
            throw BizException.of(ErrorCodes.DOWNSTREAM_UNAVAILABLE, "理财申购无返回");
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("orderNo", o.orderNo());
        result.put("productCode", o.productCode());
        result.put("productName", o.productName());
        result.put("amount", o.amount());
        result.put("status", o.status());
        result.put("confirmDate", o.confirmDate());
        return result;
    }
}
