package com.airbank.counter.strategy.impl;

import com.airbank.api.core.CoreClient;
import com.airbank.api.core.dto.TimeDepositCmd;
import com.airbank.api.core.dto.TimeDepositVO;
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
 * 定期存入（整存整取，活期转定期，docs/design/03 §4.4）。
 */
@Component
@RequiredArgsConstructor
public class TimeDepositInStrategy implements BizTypeStrategy {

    private final CoreClient coreClient;

    @Override
    public List<String> bizTypes() {
        return List.of(CounterTxn.BIZ_TIME_DEPOSIT_IN);
    }

    @Override
    public Map<String, Object> execute(ExecContext ctx) {
        Integer termMonths = ctx.intVal("termMonths");
        if (termMonths == null) {
            throw BizException.of(ErrorCodes.PARAM_INVALID, "缺少存期（月）");
        }
        Result<TimeDepositVO> r = coreClient.createTimeDeposit(null, new TimeDepositCmd(
                ctx.requestNo(), ctx.str("acctNo"), termMonths, ctx.amount(),
                ctx.tellerNo(), "COUNTER"));
        TimeDepositVO d = r == null ? null : r.getData();
        if (d == null) {
            throw BizException.of(ErrorCodes.DOWNSTREAM_UNAVAILABLE, "核心开户无返回");
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("depositNo", d.depositNo());
        result.put("acctNo", d.acctNo());
        result.put("termMonths", d.termMonths());
        result.put("amount", d.amount());
        result.put("annualRate", d.annualRate());
        result.put("valueDate", d.valueDate());
        result.put("maturityDate", d.maturityDate());
        result.put("status", d.status());
        return result;
    }
}
