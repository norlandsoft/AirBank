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
 * 当日差错冲正（一律需主管授权；仅限当本人交易的校验在受理层，5008）。
 */
@Component
@RequiredArgsConstructor
public class ReverseStrategy implements BizTypeStrategy {

    private final CoreClient coreClient;

    @Override
    public List<String> bizTypes() {
        return List.of(CounterTxn.BIZ_REVERSE);
    }

    @Override
    public Map<String, Object> execute(ExecContext ctx) {
        String txnNo = ctx.str("txnNo");
        Result<TxnVO> r = coreClient.reverseTxn(txnNo, ctx.requestNo(), ctx.tellerNo(), ctx.branchNo());
        TxnVO t = r == null ? null : r.getData();
        if (t == null) {
            throw BizException.of(ErrorCodes.DOWNSTREAM_UNAVAILABLE, "核心冲正无返回");
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("reversedTxnNo", txnNo);
        result.put("txnNo", t.txnNo());
        result.put("amount", t.amount());
        result.put("status", t.status());
        return result;
    }
}
