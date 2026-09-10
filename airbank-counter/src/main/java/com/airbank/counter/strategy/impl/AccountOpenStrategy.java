package com.airbank.counter.strategy.impl;

import com.airbank.api.core.CoreClient;
import com.airbank.api.core.dto.AccountVO;
import com.airbank.api.core.dto.OpenAccountCmd;
import com.airbank.api.uam.UamClient;
import com.airbank.api.uam.dto.CustomerCreateCmd;
import com.airbank.api.uam.dto.CustomerDTO;
import com.airbank.common.api.Result;
import com.airbank.common.exception.BizException;
import com.airbank.common.exception.ErrorCodes;
import com.airbank.counter.entity.CounterTxn;
import com.airbank.counter.strategy.BizTypeStrategy;
import com.airbank.counter.strategy.CashDirection;
import com.airbank.counter.strategy.ExecContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 开户：customerCmd 非空时先经用户中心建客户，再调核心开户（首笔现金存款激活）；
 * 初始存款计入尾箱现金流入（docs/design/03 §4.1、05 §2.1）。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AccountOpenStrategy implements BizTypeStrategy {

    private final UamClient uamClient;
    private final CoreClient coreClient;
    private final ObjectMapper objectMapper;

    @Override
    public List<String> bizTypes() {
        return List.of(CounterTxn.BIZ_ACCOUNT_OPEN);
    }

    @Override
    public Map<String, Object> execute(ExecContext ctx) {
        long amount = ctx.amount();
        if (amount <= 0) {
            throw BizException.of(ErrorCodes.PARAM_INVALID, "开户初始存款须 ≥ ¥0.01");
        }
        Long customerId = ctx.longVal("customerId");
        if (customerId == null) {
            customerId = createCustomer(ctx);
        }
        Result<AccountVO> r = coreClient.openAccount(new OpenAccountCmd(
                ctx.requestNo(), customerId, "DEMAND", amount, ctx.branchNo(), ctx.tellerNo(), "COUNTER"));
        AccountVO acct = r == null ? null : r.getData();
        if (acct == null) {
            throw BizException.of(ErrorCodes.DOWNSTREAM_UNAVAILABLE, "核心开户无返回");
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("acctNo", acct.acctNo());
        result.put("cardNo", acct.cardNo());
        result.put("customerId", acct.customerId());
        result.put("acctType", acct.acctType());
        result.put("balance", acct.balance());
        result.put("status", acct.status());
        return result;
    }

    @Override
    public CashDirection cashDirection() {
        return CashDirection.IN;
    }

    @SuppressWarnings("unchecked")
    private Long createCustomer(ExecContext ctx) {
        Object raw = ctx.payload().get("customerCmd");
        if (raw == null) {
            throw BizException.of(ErrorCodes.PARAM_INVALID, "开户缺少 customerId 或 customerCmd");
        }
        CustomerCreateCmd cmd = objectMapper.convertValue(raw, CustomerCreateCmd.class);
        Result<CustomerDTO> r = uamClient.createCustomer(cmd);
        CustomerDTO c = r == null ? null : r.getData();
        if (c == null || c.id() == null) {
            throw BizException.of(ErrorCodes.DOWNSTREAM_UNAVAILABLE, "客户创建无返回");
        }
        ctx.payload().put("customerId", c.id());
        ctx.payload().put("customerNo", c.customerNo());
        ctx.payload().put("customerName", c.customerName());
        return c.id();
    }
}
