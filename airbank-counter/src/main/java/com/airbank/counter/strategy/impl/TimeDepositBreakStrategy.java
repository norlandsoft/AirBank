package com.airbank.counter.strategy.impl;

import com.airbank.api.core.CoreClient;
import com.airbank.api.core.dto.TxnVO;
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
 * 定期支取（提前支取全额支取、按活期利率计息，docs/design/03 §4.4）。
 */
@Component
@RequiredArgsConstructor
public class TimeDepositBreakStrategy implements BizTypeStrategy {

    private final CoreClient coreClient;

    @Override
    public List<String> bizTypes() {
        return List.of(CounterTxn.BIZ_TIME_DEPOSIT_BREAK);
    }

    @Override
    public Map<String, Object> execute(ExecContext ctx) {
        String depositNo = ctx.str("depositNo");
        Result<TxnVO> r = coreClient.breakTimeDeposit(depositNo, ctx.requestNo(), ctx.tellerNo());
        TxnVO t = r == null ? null : r.getData();
        if (t == null) {
            throw BizException.of(ErrorCodes.DOWNSTREAM_UNAVAILABLE, "核心支取无返回");
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("depositNo", depositNo);
        result.put("txnNo", t.txnNo());
        result.put("acctNo", t.toAcct() != null ? t.toAcct() : t.fromAcct());
        result.put("amount", t.amount());
        result.put("balanceAfter", t.toBalanceAfter() != null ? t.toBalanceAfter() : t.fromBalanceAfter());
        result.put("status", t.status());
        return result;
    }
}
