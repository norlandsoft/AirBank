package com.airbank.core.accounting;

import com.airbank.api.core.dto.TxnCmd;
import com.airbank.api.core.dto.TxnVO;
import com.airbank.common.exception.BizException;
import com.airbank.common.exception.ErrorCodes;
import com.airbank.core.entity.Account;
import com.airbank.core.entity.Journal;
import com.airbank.core.entity.Transaction;
import com.airbank.core.mapper.AccountMapper;
import com.airbank.core.mapper.JournalMapper;
import com.airbank.core.mapper.SeqMapper;
import com.airbank.core.mapper.TransactionMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

/**
 * 账务引擎（docs/design/03 §2）：全行资金变动唯一入口。
 * 单事务内完成：幂等检查 → FOR UPDATE 行锁（按账号升序防死锁）→ 余额更新 → 流水 → 分录 → Σ借=Σ贷断言。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AccountingService {

    public static final String T_CASH_DEPOSIT = "CASH_DEPOSIT";
    public static final String T_CASH_WITHDRAW = "CASH_WITHDRAW";
    public static final String T_INNER_TRANSFER = "INNER_TRANSFER";
    public static final String T_OPENING = "OPENING";
    public static final String T_DEMAND_TO_TIME = "DEMAND_TO_TIME";
    public static final String T_TIME_MATURITY = "TIME_MATURITY";
    public static final String T_TIME_INTEREST = "TIME_INTEREST";
    public static final String T_TIME_EARLY_BREAK = "TIME_EARLY_BREAK";
    public static final String T_DEMAND_INTEREST = "DEMAND_INTEREST";
    public static final String T_WEALTH_SUBSCRIBE = "WEALTH_SUBSCRIBE";
    public static final String T_WEALTH_REDEEM = "WEALTH_REDEEM";
    public static final String T_WEALTH_INCOME = "WEALTH_INCOME";
    public static final String T_REVERSAL = "REVERSAL";

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final DateTimeFormatter TS = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("yyyyMMdd");

    /** 分录规格：借贷两侧的科目，及账户侧是否影响余额（FROM 借方减 / TO 贷方加） */
    private enum Side { FROM, TO, NONE }

    private record Spec(String drSubject, Side drAcct, String crSubject, Side crAcct) { }

    private static Spec specOf(String txnType) {
        return switch (txnType) {
            case T_CASH_DEPOSIT, T_OPENING -> new Spec("1010", Side.NONE, "2011", Side.TO);
            case T_CASH_WITHDRAW -> new Spec("2011", Side.FROM, "1010", Side.NONE);
            case T_INNER_TRANSFER -> new Spec("2011", Side.FROM, "2011", Side.TO);
            case T_DEMAND_TO_TIME -> new Spec("2011", Side.FROM, "2012", Side.NONE);
            case T_TIME_MATURITY, T_TIME_EARLY_BREAK -> new Spec("2012", Side.NONE, "2011", Side.TO);
            case T_TIME_INTEREST -> new Spec("6011", Side.NONE, "2011", Side.TO);
            case T_DEMAND_INTEREST -> new Spec("6011", Side.NONE, "2011", Side.TO);
            case T_WEALTH_SUBSCRIBE -> new Spec("2011", Side.FROM, "2061", Side.NONE);
            case T_WEALTH_REDEEM -> new Spec("2061", Side.NONE, "2011", Side.TO);
            case T_WEALTH_INCOME -> new Spec("6012", Side.NONE, "2011", Side.TO);
            default -> throw BizException.of(ErrorCodes.PARAM_INVALID, "不支持的业务类型: " + txnType);
        };
    }

    private final AccountMapper accountMapper;
    private final TransactionMapper transactionMapper;
    private final JournalMapper journalMapper;
    private final SeqMapper seqMapper;
    private final MeterRegistry meterRegistry;

    /**
     * 统一记账：幂等（requestNo）。同号同内容返回原结果（duplicated=true），同号不同内容 3004。
     */
    @Transactional
    public TxnVO post(TxnCmd cmd, LocalDate batchDate) {
        validate(cmd);
        Transaction exist = transactionMapper.selectOne(
                new LambdaQueryWrapper<Transaction>().eq(Transaction::getRequestNo, cmd.requestNo()));
        if (exist != null) {
            if (!sameCommand(exist, cmd)) {
                throw BizException.of(ErrorCodes.IDEMPOTENT_CONFLICT, "幂等冲突：requestNo 已被其他交易使用");
            }
            counter(cmd.txnType(), "duplicated");
            return toVo(exist, true);
        }
        Spec spec = specOf(cmd.txnType());

        // 行锁：按账号升序加锁防死锁
        List<String> lockNos = new ArrayList<>();
        if (usesAccount(spec.drAcct())) {
            lockNos.add(cmd.fromAcct());
        }
        if (usesAccount(spec.crAcct())) {
            lockNos.add(cmd.toAcct());
        }
        lockNos.sort(String::compareTo);
        Account from = null;
        Account to = null;
        for (String no : lockNos) {
            Account locked = lockByAcctNo(no);
            if (no.equals(cmd.fromAcct()) && usesAccount(spec.drAcct())) {
                from = locked;
            }
            if (no.equals(cmd.toAcct()) && usesAccount(spec.crAcct())) {
                to = locked;
            }
        }

        Long fromAfter = null;
        Long toAfter = null;
        if (from != null) {
            checkOutbound(from, cmd.amount());
            from.setBalance(from.getBalance() - cmd.amount());
            fromAfter = from.getBalance();
            accountMapper.updateById(from);
        }
        if (to != null) {
            checkInbound(to);
            to.setBalance(to.getBalance() + cmd.amount());
            toAfter = to.getBalance();
            accountMapper.updateById(to);
        }

        Transaction txn = new Transaction();
        txn.setTxnNo(genTxnNo());
        txn.setRequestNo(cmd.requestNo());
        txn.setTxnType(cmd.txnType());
        txn.setAmount(cmd.amount());
        txn.setFromAcct(cmd.fromAcct());
        txn.setToAcct(cmd.toAcct());
        txn.setFromBalanceAfter(fromAfter);
        txn.setToBalanceAfter(toAfter);
        txn.setChannel(cmd.channel() == null ? "SYS" : cmd.channel());
        txn.setOperator(cmd.operator());
        txn.setBranchNo(cmd.branchNo());
        txn.setSummary(cmd.summary());
        txn.setBatchDate(batchDate);
        txn.setStatus(Transaction.ST_SUCCESS);
        txn.setFinishedAt(LocalDateTime.now());
        transactionMapper.insert(txn);

        List<Journal> journals = new ArrayList<>();
        int entryNo = 1;
        if (usesAccount(spec.drAcct())) {
            journals.add(journal(txn, entryNo++, Journal.DR, spec.drSubject(), cmd.fromAcct(), cmd.amount(), fromAfter));
        } else {
            journals.add(journal(txn, entryNo++, Journal.DR, spec.drSubject(),
                    cmd.fromAcct() != null && spec.drAcct() == Side.NONE && labelFor(spec.drSubject()) ? cmd.fromAcct() : null,
                    cmd.amount(), null));
        }
        if (usesAccount(spec.crAcct())) {
            journals.add(journal(txn, entryNo++, Journal.CR, spec.crSubject(), cmd.toAcct(), cmd.amount(), toAfter));
        } else {
            journals.add(journal(txn, entryNo++, Journal.CR, spec.crSubject(),
                    cmd.toAcct() != null && labelFor(spec.crSubject()) ? cmd.toAcct() : null, cmd.amount(), null));
        }
        long dr = journals.stream().filter(j -> Journal.DR.equals(j.getDrCr())).mapToLong(Journal::getAmount).sum();
        long cr = journals.stream().filter(j -> Journal.CR.equals(j.getDrCr())).mapToLong(Journal::getAmount).sum();
        if (dr != cr) {
            throw BizException.of(ErrorCodes.ACCOUNTING_UNBALANCED, "会计分录借贷不平");
        }
        journals.forEach(journalMapper::insert);

        counter(cmd.txnType(), "success");
        return toVo(txn, false);
    }

    /**
     * 冲正：对原交易生成逐分录反向分录（docs/design/03 §4.5 / 05 §2.3）。当日有效，幂等。
     */
    @Transactional
    public TxnVO reverse(String originalTxnNo, String requestNo, String operator, String channel,
                         String branchNo, LocalDate batchDate) {
        Transaction rev = transactionMapper.selectOne(
                new LambdaQueryWrapper<Transaction>().eq(Transaction::getRequestNo, requestNo));
        if (rev != null) {
            return toVo(rev, true);
        }
        Transaction origin = transactionMapper.selectOne(
                new LambdaQueryWrapper<Transaction>().eq(Transaction::getTxnNo, originalTxnNo));
        if (origin == null) {
            throw BizException.of(ErrorCodes.NOT_FOUND, "原交易不存在");
        }
        if (!Transaction.ST_SUCCESS.equals(origin.getStatus())) {
            throw BizException.of(ErrorCodes.REVERSE_DENY, "原交易状态不允许冲正");
        }
        if (!batchDate.equals(origin.getBatchDate())) {
            throw BizException.of(ErrorCodes.REVERSE_DENY, "仅支持当日冲正");
        }
        List<Journal> origins = journalMapper.selectList(
                new LambdaQueryWrapper<Journal>().eq(Journal::getTxnNo, originalTxnNo).orderByAsc(Journal::getEntryNo));

        // 涉及余额的账户先按账号排序加锁
        List<Journal> acctEntries = origins.stream().filter(j -> j.getAcctNo() != null && j.getBalanceAfter() != null).toList();
        acctEntries.stream().map(Journal::getAcctNo).distinct().sorted().forEach(this::lockByAcctNo);

        Transaction txn = new Transaction();
        txn.setTxnNo(genTxnNo());
        txn.setRequestNo(requestNo);
        txn.setTxnType(T_REVERSAL);
        txn.setAmount(origin.getAmount());
        txn.setFromAcct(origin.getToAcct());
        txn.setToAcct(origin.getFromAcct());
        txn.setChannel(channel);
        txn.setOperator(operator);
        txn.setBranchNo(branchNo);
        txn.setSummary("冲正 " + originalTxnNo + (origin.getSummary() == null ? "" : " " + origin.getSummary()));
        txn.setBatchDate(batchDate);
        txn.setStatus(Transaction.ST_SUCCESS);
        txn.setReverseOf(originalTxnNo);
        txn.setFinishedAt(LocalDateTime.now());

        List<Journal> journals = new ArrayList<>();
        int entryNo = 1;
        for (Journal j : origins) {
            boolean balanceAccount = j.getAcctNo() != null && j.getBalanceAfter() != null;
            String flipped = Journal.DR.equals(j.getDrCr()) ? Journal.CR : Journal.DR;
            Long after = null;
            if (balanceAccount) {
                Account acct = lockByAcctNo(j.getAcctNo());
                long delta = Journal.DR.equals(j.getDrCr()) ? j.getAmount() : -j.getAmount();
                acct.setBalance(acct.getBalance() + delta);
                if (acct.getBalance() < 0) {
                    throw BizException.of(ErrorCodes.BALANCE_NOT_ENOUGH, "冲正后余额不足，无法冲正");
                }
                after = acct.getBalance();
                accountMapper.updateById(acct);
            }
            Journal nj = new Journal();
            nj.setTxnNo(txn.getTxnNo());
            nj.setEntryNo(entryNo++);
            nj.setDrCr(flipped);
            nj.setSubjectCode(j.getSubjectCode());
            nj.setAcctNo(j.getAcctNo());
            nj.setAmount(j.getAmount());
            nj.setBalanceAfter(after);
            nj.setSummary(txn.getSummary());
            nj.setBatchDate(batchDate);
            journals.add(nj);
        }
        transactionMapper.insert(txn);
        journals.forEach(journalMapper::insert);
        origin.setStatus(Transaction.ST_REVERSED);
        transactionMapper.updateById(origin);
        counter(T_REVERSAL, "success");
        return toVo(txn, false);
    }

    /** 记账前的账户校验：状态（出金仅 ACTIVE）与可用余额 */
    public void checkOutbound(Account acct, long amount) {
        if (acct == null) {
            throw BizException.of(ErrorCodes.ACCT_NOT_FOUND, "付款账户不存在");
        }
        if ("CLOSED".equals(acct.getStatus())) {
            throw BizException.of(ErrorCodes.ACCT_CLOSED, "账户已销户");
        }
        if (!"ACTIVE".equals(acct.getStatus())) {
            throw BizException.of(ErrorCodes.ACCT_STATUS_DENY, "账户状态为" + statusName(acct.getStatus()) + "，不允许出金");
        }
        if (acct.getBalance() - acct.getFrozenAmount() < amount) {
            throw BizException.of(ErrorCodes.BALANCE_NOT_ENOUGH, "账户余额不足");
        }
    }

    public void checkInbound(Account acct) {
        if (acct == null) {
            throw BizException.of(ErrorCodes.PAYEE_DENY, "收款账户不存在");
        }
        if ("CLOSED".equals(acct.getStatus()) || "FROZEN".equals(acct.getStatus())) {
            throw BizException.of(ErrorCodes.PAYEE_DENY, "收款账户当前状态不可入金");
        }
    }

    /** SELECT ... FOR UPDATE */
    public Account lockByAcctNo(String acctNo) {
        Account acct = accountMapper.selectForUpdate(acctNo);
        if (acct == null) {
            throw BizException.of(ErrorCodes.ACCT_NOT_FOUND, "账户不存在: " + acctNo);
        }
        return acct;
    }

    public TxnVO toVo(Transaction t, boolean duplicated) {
        return new TxnVO(t.getTxnNo(), t.getRequestNo(), t.getTxnType(), t.getFromAcct(), t.getToAcct(),
                t.getAmount(), t.getSummary(), t.getChannel(), t.getOperator(), t.getStatus(),
                t.getBatchDate() == null ? null : t.getBatchDate().toString(), duplicated,
                t.getFromBalanceAfter(), t.getToBalanceAfter(),
                t.getFinishedAt() == null ? null : t.getFinishedAt().toString());
    }

    private boolean usesAccount(Side side) {
        return side == Side.FROM || side == Side.TO;
    }

    /** 2012/2061/1010 等非账户余额侧，是否带账号标签（供明细追溯） */
    private boolean labelFor(String subject) {
        return "2012".equals(subject) || "2061".equals(subject);
    }

    private void validate(TxnCmd cmd) {
        if (cmd.requestNo() == null || cmd.requestNo().isBlank()) {
            throw BizException.of(ErrorCodes.PARAM_INVALID, "requestNo 不能为空");
        }
        if (cmd.amount() <= 0) {
            throw BizException.of(ErrorCodes.AMOUNT_INVALID, "交易金额必须大于 0");
        }
        Spec spec = specOf(cmd.txnType());
        if (usesAccount(spec.drAcct()) && (cmd.fromAcct() == null || cmd.fromAcct().isBlank())) {
            throw BizException.of(ErrorCodes.PARAM_INVALID, "该业务类型需要付款账户");
        }
        if (usesAccount(spec.crAcct()) && (cmd.toAcct() == null || cmd.toAcct().isBlank())) {
            throw BizException.of(ErrorCodes.PARAM_INVALID, "该业务类型需要收款账户");
        }
        if (cmd.fromAcct() != null && cmd.fromAcct().equals(cmd.toAcct())
                && usesAccount(spec.drAcct()) && usesAccount(spec.crAcct())) {
            throw BizException.of(ErrorCodes.PARAM_INVALID, "收付款账户不能相同");
        }
    }

    private boolean sameCommand(Transaction t, TxnCmd cmd) {
        return t.getTxnType().equals(cmd.txnType()) && t.getAmount().equals(cmd.amount())
                && java.util.Objects.equals(t.getFromAcct(), cmd.fromAcct())
                && java.util.Objects.equals(t.getToAcct(), cmd.toAcct());
    }

    private Journal journal(Transaction txn, int entryNo, String drCr, String subject, String acctNo,
                            long amount, Long balanceAfter) {
        Journal j = new Journal();
        j.setTxnNo(txn.getTxnNo());
        j.setEntryNo(entryNo);
        j.setDrCr(drCr);
        j.setSubjectCode(subject);
        j.setAcctNo(acctNo);
        j.setAmount(amount);
        j.setBalanceAfter(balanceAfter);
        j.setSummary(txn.getSummary());
        j.setBatchDate(txn.getBatchDate());
        return j;
    }

    private Account lockOrNull(String acctNo) {
        return acctNo == null ? null : accountMapper.selectForUpdate(acctNo);
    }

    private String genTxnNo() {
        String rand = String.valueOf((char) ('a' + RANDOM.nextInt(26)))
                + (char) ('a' + RANDOM.nextInt(26)) + (char) ('a' + RANDOM.nextInt(26));
        return IdGen.txnNo(LocalDateTime.now().format(TS), seqMapper.nextval("seq_txn"), rand);
    }

    public String today() {
        return LocalDate.now().format(DAY);
    }

    private void counter(String txnType, String result) {
        Counter.builder("airbank_txn_total").tag("txn_type", txnType).tag("result", result)
                .register(meterRegistry).increment();
    }

    private String statusName(String status) {
        return switch (status) {
            case "FROZEN" -> "冻结";
            case "STOP_PAYMENT" -> "止付";
            case "CLOSED" -> "销户";
            default -> status;
        };
    }
}
