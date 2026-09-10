package com.airbank.core.service;

import com.airbank.api.core.dto.TxnCmd;
import com.airbank.common.exception.BizException;
import com.airbank.common.exception.ErrorCodes;
import com.airbank.core.accounting.AccountingService;
import com.airbank.core.config.CoreParams;
import com.airbank.core.entity.Account;
import com.airbank.core.entity.AccrualInterest;
import com.airbank.core.entity.Transaction;
import com.airbank.core.mapper.AccrualInterestMapper;
import com.airbank.core.mapper.AccountMapper;
import com.airbank.core.mapper.TransactionMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.MonthDay;
import java.util.List;

/**
 * 利息服务：每日计提（只计提不入账）+ 季度结息（6011→2011，docs/design/03 §5）。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class InterestService {

    private static final List<MonthDay> SETTLE_DAYS = List.of(MonthDay.of(3, 20), MonthDay.of(6, 20),
            MonthDay.of(9, 20), MonthDay.of(12, 20));

    private final AccrualInterestMapper accrualMapper;
    private final AccountMapper accountMapper;
    private final TransactionMapper transactionMapper;
    private final AccountingService accounting;
    private final CoreParams params;

    /** 日终计提：逐户 accrual = 日终余额 × 年利率 / 360；幂等键 (acct_no, batch_date) */
    @Transactional
    public int accrue(LocalDate batchDate) {
        BigDecimal rate = BigDecimal.valueOf(params.getDemandRate());
        List<Account> accounts = accountMapper.selectList(new LambdaQueryWrapper<Account>()
                .eq(Account::getAcctType, Account.TYPE_DEMAND)
                .eq(Account::getStatus, "ACTIVE")
                .gt(Account::getBalance, 0));
        int n = 0;
        for (Account a : accounts) {
            boolean exists = accrualMapper.selectCount(new LambdaQueryWrapper<AccrualInterest>()
                    .eq(AccrualInterest::getAcctNo, a.getAcctNo())
                    .eq(AccrualInterest::getBatchDate, batchDate)) > 0;
            if (exists) {
                continue;
            }
            long accrual = com.airbank.core.accounting.InterestCalc.demandAccrual(a.getBalance(), rate);
            AccrualInterest rec = new AccrualInterest();
            rec.setAcctNo(a.getAcctNo());
            rec.setBatchDate(batchDate);
            rec.setAccrual(accrual);
            rec.setRate(rate);
            accrualMapper.insert(rec);
            a.setAccruedInterest(a.getAccruedInterest() + accrual);
            accountMapper.updateById(a);
            n++;
        }
        return n;
    }

    /** 结息：季末 20 日（或 force）对有计提累计的账户入账 */
    @Transactional
    public int settle(LocalDate batchDate, boolean force) {
        if (!force && !SETTLE_DAYS.contains(MonthDay.from(batchDate))) {
            return 0;
        }
        List<Account> accounts = accountMapper.selectList(new LambdaQueryWrapper<Account>()
                .eq(Account::getAcctType, Account.TYPE_DEMAND)
                .eq(Account::getStatus, "ACTIVE")
                .gt(Account::getAccruedInterest, 0));
        int n = 0;
        for (Account a : accounts) {
            String requestNo = "INT:" + a.getAcctNo() + ":" + batchDate;
            if (transactionMapper.selectCount(new LambdaQueryWrapper<Transaction>()
                    .eq(Transaction::getRequestNo, requestNo)) > 0) {
                a.setAccruedInterest(0L);
                a.setLastInterestDate(batchDate);
                accountMapper.updateById(a);
                continue;
            }
            accounting.post(new TxnCmd(requestNo, AccountingService.T_DEMAND_INTEREST, null,
                    a.getAcctNo(), a.getAccruedInterest(), "活期结息",
                    "BATCH", "batch", a.getBranchNo()), batchDate);
            a.setAccruedInterest(0L);
            a.setLastInterestDate(batchDate);
            accountMapper.updateById(a);
            n++;
        }
        return n;
    }

    public void checkActive(String acctNo) {
        Account a = accountMapper.selectOne(new LambdaQueryWrapper<Account>().eq(Account::getAcctNo, acctNo));
        if (a == null) {
            throw BizException.of(ErrorCodes.ACCT_NOT_FOUND, "账户不存在");
        }
    }
}
