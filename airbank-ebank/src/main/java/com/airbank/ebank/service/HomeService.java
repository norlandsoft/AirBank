package com.airbank.ebank.service;

import com.airbank.api.core.CoreClient;
import com.airbank.api.core.dto.AccountVO;
import com.airbank.api.core.dto.TimeDepositVO;
import com.airbank.api.core.dto.TxnQuery;
import com.airbank.api.core.dto.TxnVO;
import com.airbank.api.uam.UamClient;
import com.airbank.api.uam.dto.CustomerDTO;
import com.airbank.api.wealth.WealthClient;
import com.airbank.api.wealth.dto.PositionVO;
import com.airbank.ebank.model.HomeVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 资产总览（docs/design/05 §3.4）：存款余额 + 理财持仓聚合 + 近 10 笔交易。
 */
@Service
@RequiredArgsConstructor
public class HomeService {

    private static final String TD_HOLDING = "HOLDING";

    private final UamClient uamClient;
    private final CoreClient coreClient;
    private final WealthClient wealthClient;

    public HomeVO home(Long customerId) {
        CustomerDTO customer = OwnerGuard.data(uamClient.getCustomer(customerId));
        List<AccountVO> accounts = nvl(OwnerGuard.data(coreClient.listAccounts(customerId)));
        List<TimeDepositVO> timeDeposits = nvl(OwnerGuard.data(coreClient.listTimeDeposits(customerId, null)));
        List<PositionVO> positions = nvl(OwnerGuard.data(wealthClient.positions(customerId)));

        long demandTotal = accounts.stream()
                .filter(a -> "DEMAND".equals(a.acctType()))
                .mapToLong(AccountVO::balance).sum();
        long holdingTimeTotal = timeDeposits.stream()
                .filter(t -> TD_HOLDING.equals(t.status()))
                .mapToLong(TimeDepositVO::amount).sum();
        long wealthTotal = positions.stream()
                .mapToLong(p -> p.costAmount() + p.accruingIncome()).sum();
        long accruingIncome = positions.stream()
                .mapToLong(PositionVO::accruingIncome).sum();

        TxnQuery q = new TxnQuery();
        q.setCustomerId(customerId);
        q.setPageNum(1);
        q.setPageSize(10);
        List<TxnVO> recentTxns = nvl(OwnerGuard.data(coreClient.pageTxns(q)).getList());

        return new HomeVO(
                customer == null ? null : customer.customerName(),
                customer == null ? null : customer.riskLevel(),
                accounts,
                demandTotal + holdingTimeTotal,
                timeDeposits,
                positions,
                wealthTotal,
                accruingIncome,
                recentTxns);
    }

    private static <T> List<T> nvl(List<T> list) {
        return list == null ? List.of() : list;
    }
}
