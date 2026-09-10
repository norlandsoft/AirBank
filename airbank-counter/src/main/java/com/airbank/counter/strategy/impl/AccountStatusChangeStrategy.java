package com.airbank.counter.strategy.impl;

import com.airbank.api.core.CoreClient;
import com.airbank.api.core.dto.AccountStatusCmd;
import com.airbank.api.core.dto.AccountVO;
import com.airbank.common.api.Result;
import com.airbank.counter.entity.CounterTxn;
import com.airbank.counter.strategy.BizTypeStrategy;
import com.airbank.counter.strategy.ExecContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 冻结 / 解冻 / 销户：核心账户状态迁移（一律需主管授权，docs/design/03 §4.5、05 §2.2）。
 */
@Component
@RequiredArgsConstructor
public class AccountStatusChangeStrategy implements BizTypeStrategy {

    private final CoreClient coreClient;

    @Override
    public List<String> bizTypes() {
        return List.of(CounterTxn.BIZ_ACCOUNT_FREEZE,
                CounterTxn.BIZ_ACCOUNT_UNFREEZE,
                CounterTxn.BIZ_ACCOUNT_CLOSE,
                CounterTxn.BIZ_ACCOUNT_STOP_PAYMENT,
                CounterTxn.BIZ_ACCOUNT_RESUME_PAYMENT);
    }

    @Override
    public Map<String, Object> execute(ExecContext ctx) {
        String action = switch (ctx.txn().getBizType()) {
            case CounterTxn.BIZ_ACCOUNT_FREEZE -> "FREEZE";
            case CounterTxn.BIZ_ACCOUNT_UNFREEZE -> "UNFREEZE";
            case CounterTxn.BIZ_ACCOUNT_CLOSE -> "CLOSE";
            case CounterTxn.BIZ_ACCOUNT_STOP_PAYMENT -> "STOP_PAYMENT";
            case CounterTxn.BIZ_ACCOUNT_RESUME_PAYMENT -> "RESUME_PAYMENT";
            default -> throw new IllegalStateException("非法 bizType");
        };
        Result<AccountVO> r = coreClient.changeAccountStatus(ctx.str("acctNo"), null, new AccountStatusCmd(
                ctx.requestNo(), action, ctx.tellerNo(), ctx.str("reason")));
        AccountVO a = r == null ? null : r.getData();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("acctNo", ctx.str("acctNo"));
        result.put("action", action);
        result.put("status", a != null ? a.status() : null);
        return result;
    }
}
