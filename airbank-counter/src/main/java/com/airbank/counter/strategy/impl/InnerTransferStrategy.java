package com.airbank.counter.strategy.impl;

import com.airbank.api.core.CoreClient;
import com.airbank.api.core.dto.TxnCmd;
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
 * 行内转账（非现金，不动尾箱；docs/design/03 §4.3）。
 */
@Component
@RequiredArgsConstructor
public class InnerTransferStrategy implements BizTypeStrategy {

    private final CoreClient coreClient;

    @Override
    public List<String> bizTypes() {
        return List.of(CounterTxn.BIZ_INNER_TRANSFER);
    }

    @Override
    public Map<String, Object> execute(ExecContext ctx) {
        Result<TxnVO> r = coreClient.postTxn(null, new TxnCmd(
                ctx.requestNo(), "INNER_TRANSFER", ctx.str("acctNo"), ctx.str("toAcct"), ctx.amount(),
                ctx.str("summary"), "COUNTER", ctx.tellerNo(), ctx.branchNo()));
        TxnVO t = r == null ? null : r.getData();
        if (t == null) {
            throw BizException.of(ErrorCodes.DOWNSTREAM_UNAVAILABLE, "核心记账无返回");
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("txnNo", t.txnNo());
        result.put("fromAcct", t.fromAcct());
        result.put("toAcct", t.toAcct());
        result.put("amount", t.amount());
        result.put("fromBalanceAfter", t.fromBalanceAfter());
        result.put("toBalanceAfter", t.toBalanceAfter());
        result.put("status", t.status());
        return result;
    }
}
