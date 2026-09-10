package com.airbank.core.service;

import com.airbank.api.core.dto.AccountVO;

import java.util.List;

/**
 * 查询辅助：按客户号取名下活期账号列表（跨表只读查询）。
 */
public final class QueryHelper {

    private QueryHelper() {
    }

    public static List<String> acctNosOf(AccountService accountService, Long customerId) {
        return accountService.byCustomer(customerId).stream()
                .filter(a -> "DEMAND".equals(a.acctType()))
                .map(AccountVO::acctNo)
                .toList();
    }
}
