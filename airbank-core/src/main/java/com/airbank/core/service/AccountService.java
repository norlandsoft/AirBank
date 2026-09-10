package com.airbank.core.service;

import com.airbank.api.core.dto.AccountStatusCmd;
import com.airbank.api.core.dto.AccountVO;
import com.airbank.api.core.dto.OpenAccountCmd;
import com.airbank.api.core.dto.TxnCmd;
import com.airbank.api.core.dto.TxnVO;
import com.airbank.common.exception.BizException;
import com.airbank.common.exception.ErrorCodes;
import com.airbank.core.accounting.AccountingService;
import com.airbank.core.accounting.IdGen;
import com.airbank.core.entity.Account;
import com.airbank.core.entity.Transaction;
import com.airbank.core.mapper.AccountMapper;
import com.airbank.core.mapper.SeqMapper;
import com.airbank.core.mapper.TransactionMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 账户域：开户（首笔存款激活）/ 状态机（docs/design/03 §1、§4.1）。
 */
@Service
@RequiredArgsConstructor
public class AccountService {

    private final AccountMapper accountMapper;
    private final TransactionMapper transactionMapper;
    private final AccountingService accounting;
    private final SeqMapper seqMapper;

    @Transactional
    public AccountVO open(OpenAccountCmd cmd, LocalDate batchDate) {
        if (cmd.initialAmount() < 100) {
            throw BizException.of(ErrorCodes.AMOUNT_INVALID, "开户初始存款须 ≥ ¥1.00");
        }
        // 幂等：requestNo 已存在 → 返回该笔交易对应的账户
        Transaction exist = transactionMapper.selectOne(
                new LambdaQueryWrapper<Transaction>().eq(Transaction::getRequestNo, cmd.requestNo()));
        if (exist != null) {
            return toVo(accountMapper.selectOne(
                    new LambdaQueryWrapper<Account>().eq(Account::getAcctNo, exist.getToAcct())));
        }
        Account acct = new Account();
        acct.setAcctNo(IdGen.acctNo(cmd.branchNo() == null ? "990" : cmd.branchNo(),
                IdGen.PRODUCT_DEMAND, seqMapper.nextval("seq_acct")));
        acct.setCardNo(IdGen.cardNo(seqMapper.nextval("seq_card")));
        acct.setCustomerId(cmd.customerId());
        acct.setAcctType(Account.TYPE_DEMAND);
        acct.setProductCode(IdGen.PRODUCT_DEMAND);
        acct.setSubjectCode("2011");
        acct.setBranchNo(cmd.branchNo() == null ? "990" : cmd.branchNo());
        acct.setBalance(0L);
        acct.setFrozenAmount(0L);
        acct.setAccruedInterest(0L);
        acct.setStatus("ACTIVE");
        acct.setOpenedAt(LocalDateTime.now());
        accountMapper.insert(acct);

        accounting.post(new TxnCmd(cmd.requestNo(), AccountingService.T_CASH_DEPOSIT, null,
                acct.getAcctNo(), cmd.initialAmount(), "开户首笔存款",
                cmd.channel(), cmd.operator(), acct.getBranchNo()), batchDate);
        return toVo(acct);
    }

    /** 账户状态机：FREEZE/UNFREEZE/STOP_PAYMENT/RESUME_PAYMENT/CLOSE，0 金额流水留痕 */
    @Transactional
    public AccountVO changeStatus(String acctNo, AccountStatusCmd cmd, LocalDate batchDate) {
        Transaction exist = transactionMapper.selectOne(
                new LambdaQueryWrapper<Transaction>().eq(Transaction::getRequestNo, cmd.requestNo()));
        if (exist != null) {
            return toVo(requireEntity(exist.getToAcct() != null ? exist.getToAcct() : exist.getFromAcct()));
        }
        Account acct = accounting.lockByAcctNo(acctNo);
        String target = switch (cmd.action()) {
            case "FREEZE" -> "FROZEN";
            case "UNFREEZE" -> "ACTIVE";
            case "STOP_PAYMENT" -> "STOP_PAYMENT";
            case "RESUME_PAYMENT" -> "ACTIVE";
            case "CLOSE" -> "CLOSED";
            default -> throw BizException.of(ErrorCodes.PARAM_INVALID, "未知账户动作: " + cmd.action());
        };
        if ("CLOSED".equals(acct.getStatus())) {
            throw BizException.of(ErrorCodes.ACCT_CLOSED, "账户已销户");
        }
        if ("CLOSE".equals(cmd.action())) {
            if (acct.getBalance() > 0 || acct.getFrozenAmount() > 0) {
                throw BizException.of(ErrorCodes.ACCT_STATUS_DENY, "销户要求余额与冻结金额为零，请先转出");
            }
            acct.setClosedAt(LocalDateTime.now());
        }
        acct.setStatus(target);
        accountMapper.updateById(acct);

        Transaction txn = new Transaction();
        txn.setTxnNo("TX" + batchDate.toString().replace("-", "") + String.format("%08d", seqMapper.nextval("seq_txn") % 100_000_000));
        txn.setRequestNo(cmd.requestNo());
        txn.setTxnType("ACCT_" + cmd.action());
        txn.setAmount(0L);
        txn.setFromAcct(acctNo);
        txn.setChannel("COUNTER");
        txn.setOperator(cmd.operator());
        txn.setSummary((cmd.reason() == null ? "" : cmd.reason()) + " 账户状态→" + target);
        txn.setBatchDate(batchDate);
        txn.setStatus(Transaction.ST_SUCCESS);
        txn.setFinishedAt(LocalDateTime.now());
        transactionMapper.insert(txn);
        return toVo(acct);
    }

    public Account requireEntity(String acctNo) {
        Account a = acctNo != null ? accountMapper.selectOne(
                new LambdaQueryWrapper<Account>().eq(Account::getAcctNo, acctNo)) : null;
        if (a == null) {
            throw BizException.of(ErrorCodes.ACCT_NOT_FOUND, "账户不存在");
        }
        return a;
    }

    public AccountVO byAcctNo(String acctNo) {
        return toVo(requireEntity(acctNo));
    }

    public AccountVO byCardNo(String cardNo) {
        Account a = accountMapper.selectOne(new LambdaQueryWrapper<Account>().eq(Account::getCardNo, cardNo));
        return a == null ? null : toVo(a);
    }

    public List<AccountVO> byCustomer(Long customerId) {
        return accountMapper.selectList(new LambdaQueryWrapper<Account>()
                        .eq(Account::getCustomerId, customerId).orderByAsc(Account::getAcctType))
                .stream().map(this::toVo).toList();
    }

    public AccountVO toVo(Account a) {
        return new AccountVO(a.getId(), a.getAcctNo(), a.getCardNo(), a.getCustomerId(), a.getAcctType(),
                a.getProductCode(), a.getStatus(), a.getBalance(), a.getFrozenAmount(), a.getAccruedInterest(),
                a.getBranchNo(), a.getOpenedAt() == null ? null : a.getOpenedAt().toString());
    }

    /** 供冲正等场景：当日日期（会计日期） */
    public LocalDate batchDateOf(String dateOrNull) {
        return dateOrNull == null ? LocalDate.now() : LocalDate.parse(dateOrNull);
    }
}
