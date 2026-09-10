package com.airbank.ebank.service;

import com.airbank.api.core.CoreClient;
import com.airbank.api.core.dto.AccountVO;
import com.airbank.api.core.dto.TimeDepositVO;
import com.airbank.api.core.dto.TxnQuery;
import com.airbank.api.core.dto.TxnVO;
import com.airbank.common.api.PageResult;
import com.airbank.common.exception.BizException;
import com.airbank.common.exception.ErrorCodes;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 账户查询（网银客户本人视角）：账户列表、核心流水分页、定期存单。
 */
@Service
@RequiredArgsConstructor
public class AccountQueryService {

    private final CoreClient coreClient;

    /** GET /accounts：本人账户列表 */
    public List<AccountVO> myAccounts(Long customerId) {
        return OwnerGuard.data(coreClient.listAccounts(customerId));
    }

    /** GET /accounts/{acctNo}/details：本人账户的核心流水分页（归属校验 6008） */
    public PageResult<TxnVO> accountDetails(Long customerId, String acctNo, int pageNum, int pageSize) {
        requireOwnAccount(customerId, acctNo);
        TxnQuery q = new TxnQuery();
        q.setAcctNo(acctNo);
        q.setPageNum(pageNum);
        q.setPageSize(pageSize);
        return OwnerGuard.data(coreClient.pageTxns(q));
    }

    /** GET /time-deposits：本人定期存单列表 */
    public List<TimeDepositVO> myTimeDeposits(Long customerId) {
        return OwnerGuard.data(coreClient.listTimeDeposits(customerId, null));
    }

    /** 归属校验：账户不存在（3001 透传）/ 非本人 → 6008 */
    public AccountVO requireOwnAccount(Long customerId, String acctNo) {
        AccountVO acct = OwnerGuard.data(coreClient.getAccount(acctNo));
        if (acct == null || !customerId.equals(acct.customerId())) {
            throw BizException.of(ErrorCodes.NOT_OWNER, "非本人账户，禁止操作");
        }
        return acct;
    }
}
