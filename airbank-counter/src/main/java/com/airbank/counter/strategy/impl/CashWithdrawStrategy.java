package com.airbank.counter.strategy.impl;

import com.airbank.api.core.CoreClient;
import com.airbank.api.core.dto.TxnCmd;
import com.airbank.api.core.dto.TxnVO;
import com.airbank.common.api.Result;
import com.airbank.common.exception.BizException;
import com.airbank.common.exception.ErrorCodes;
import com.airbank.counter.entity.CounterTxn;
import com.airbank.counter.strategy.BizTypeStrategy;
import com.airbank.counter.strategy.CashDirection;
import com.airbank.counter.strategy.ExecContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 现金取款：核心 CASH_WITHDRAW 记账 + 尾箱现金流出（尾箱不足 5002 在执行前置校验）。
 */
@Component
@RequiredArgsConstructor
public class CashWithdrawStrategy implements BizTypeStrategy {

    private final CoreClient coreClient;

    @Override
    public List<String> bizTypes() {
        return List.of(CounterTxn.BIZ_CASH_WITHDRAW);
    }

    @Override
    public Map<String, Object> execute(ExecContext ctx) {
        String acctNo = ctx.str("acctNo");
        Result<TxnVO> r = coreClient.postTxn(null, new TxnCmd(
                ctx.requestNo(), "CASH_WITHDRAW", acctNo, null, ctx.amount(),
                ctx.str("summary"), "COUNTER", ctx.tellerNo(), ctx.branchNo()));
        TxnVO t = r == null ? null : r.getData();
        if (t == null) {
            throw BizException.of(ErrorCodes.DOWNSTREAM_UNAVAILABLE, "核心记账无返回");
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("txnNo", t.txnNo());
        result.put("acctNo", t.fromAcct());
        result.put("amount", t.amount());
        result.put("balanceAfter", t.fromBalanceAfter());
        result.put("status", t.status());
        return result;
    }

    @Override
    public CashDirection cashDirection() {
        return CashDirection.OUT;
    }
}
