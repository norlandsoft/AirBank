package com.airbank.core.service;

import com.airbank.api.core.dto.TimeDepositCmd;
import com.airbank.api.core.dto.TxnVO;
import com.airbank.api.core.dto.TimeDepositVO;
import com.airbank.api.core.dto.TxnCmd;
import com.airbank.common.exception.BizException;
import com.airbank.common.exception.ErrorCodes;
import com.airbank.core.accounting.AccountingService;
import com.airbank.core.accounting.IdGen;
import com.airbank.core.accounting.InterestCalc;
import com.airbank.core.config.CoreParams;
import com.airbank.core.entity.Account;
import com.airbank.core.entity.TimeDeposit;
import com.airbank.core.entity.Transaction;
import com.airbank.core.mapper.SeqMapper;
import com.airbank.core.mapper.TimeDepositMapper;
import com.airbank.core.mapper.TransactionMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * 定期存款（整存整取）：存入/到期兑付/提前支取（docs/design/03 §4.4）。
 */
@Service
@RequiredArgsConstructor
public class TimeDepositService {

    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("yyyyMMdd");

    private final TimeDepositMapper depositMapper;
    private final TransactionMapper transactionMapper;
    private final AccountService accountService;
    private final AccountingService accounting;
    private final CoreParams params;
    private final SeqMapper seqMapper;

    @Transactional
    public TimeDepositVO create(TimeDepositCmd cmd, LocalDate batchDate) {
        Transaction exist = transactionMapper.selectOne(
                new LambdaQueryWrapper<Transaction>().eq(Transaction::getRequestNo, cmd.requestNo()));
        if (exist != null) {
            TimeDeposit d = depositMapper.selectOne(
                    new LambdaQueryWrapper<TimeDeposit>().eq(TimeDeposit::getAcctNo, cmd.acctNo())
                            .eq(TimeDeposit::getAmount, cmd.amount()).orderByDesc(TimeDeposit::getId).last("LIMIT 1"));
            if (d != null) {
                return toVo(d);
            }
            throw BizException.of(ErrorCodes.IDEMPOTENT_CONFLICT, "幂等冲突：requestNo 已被其他交易使用");
        }
        if (cmd.amount() < params.getTimeDepositMin()) {
            throw BizException.of(ErrorCodes.TIME_DEPOSIT_MIN, "定期起存金额为 ¥"
                    + com.airbank.common.util.Money.fenToYuan(params.getTimeDepositMin()));
        }
        double rate = params.rateFor(cmd.termMonths());
        Account acct = accountService.requireEntity(cmd.acctNo());

        accounting.post(new TxnCmd(cmd.requestNo(), AccountingService.T_DEMAND_TO_TIME, acct.getAcctNo(),
                acct.getAcctNo(), cmd.amount(), "活期转定期(" + cmd.termMonths() + "个月)",
                cmd.channel(), cmd.operator(), acct.getBranchNo()), batchDate);

        TimeDeposit d = new TimeDeposit();
        d.setDepositNo(IdGen.depositNo(batchDate.format(DAY), seqMapper.nextval("seq_deposit")));
        d.setAcctNo(acct.getAcctNo());
        d.setTermMonths(cmd.termMonths());
        d.setAnnualRate(BigDecimal.valueOf(rate));
        d.setAmount(cmd.amount());
        d.setValueDate(batchDate);
        d.setMaturityDate(batchDate.plusMonths(cmd.termMonths()));
        d.setInterest(InterestCalc.timeInterest(cmd.amount(), d.getAnnualRate(), cmd.termMonths()));
        d.setStatus(TimeDeposit.ST_HOLDING);
        depositMapper.insert(d);
        return toVo(d);
    }

    /** 提前支取：本金按活期利率计息，全额支取（docs/design/03 §4.4） */
    @Transactional
    public List<TxnVO> breakDeposit(String depositNo, String requestNo, String operator, LocalDate batchDate) {
        TimeDeposit d = depositMapper.selectOne(
                new LambdaQueryWrapper<TimeDeposit>().eq(TimeDeposit::getDepositNo, depositNo));
        if (d == null) {
            throw BizException.of(ErrorCodes.NOT_FOUND, "存单不存在");
        }
        if (!TimeDeposit.ST_HOLDING.equals(d.getStatus())) {
            throw BizException.of(ErrorCodes.DEPOSIT_STATUS_DENY, "存单状态不允许支取");
        }
        Account acct = accounting.lockByAcctNo(d.getAcctNo());
        accounting.checkOutbound(acct, 0); // 状态校验（金额 0 跳过余额判断）
        accounting.checkInbound(acct);

        long interest = InterestCalc.earlyBreakInterest(d.getAmount(), BigDecimal.valueOf(params.getDemandRate()),
                d.getValueDate(), batchDate);
        TxnVO principal = accounting.post(new TxnCmd(requestNo + ":P", AccountingService.T_TIME_EARLY_BREAK,
                d.getAcctNo(), d.getAcctNo(), d.getAmount(), "定期提前支取本金 " + depositNo,
                "COUNTER", operator, acct.getBranchNo()), batchDate);
        TxnVO interestTxn = accounting.post(new TxnCmd(requestNo + ":I", AccountingService.T_TIME_INTEREST,
                null, d.getAcctNo(), interest, "定期提前支取利息(活期利率) " + depositNo,
                "COUNTER", operator, acct.getBranchNo()), batchDate);

        d.setStatus(TimeDeposit.ST_BROKEN);
        d.setPaidAt(LocalDateTime.now());
        depositMapper.updateById(d);
        return List.of(principal, interestTxn);
    }

    /** 到期兑付（日终批量调用，docs/design/03 §8 step2） */
    @Transactional
    public int matureDue(LocalDate batchDate) {
        List<TimeDeposit> due = depositMapper.selectList(new LambdaQueryWrapper<TimeDeposit>()
                .eq(TimeDeposit::getStatus, TimeDeposit.ST_HOLDING)
                .le(TimeDeposit::getMaturityDate, batchDate));
        int n = 0;
        for (TimeDeposit d : due) {
            String req = "MAT:" + d.getDepositNo() + ":" + batchDate;
            if (transactionMapper.selectCount(new LambdaQueryWrapper<Transaction>()
                    .eq(Transaction::getRequestNo, req + ":P")) > 0) {
                d.setStatus(TimeDeposit.ST_MATURED);
                d.setPaidAt(LocalDateTime.now());
                depositMapper.updateById(d);
                continue;
            }
            Account acct = accountService.requireEntity(d.getAcctNo());
            accounting.post(new TxnCmd(req + ":P", AccountingService.T_TIME_MATURITY, d.getAcctNo(),
                    d.getAcctNo(), d.getAmount(), "定期到期兑付本金 " + d.getDepositNo(),
                    "BATCH", "batch", acct.getBranchNo()), batchDate);
            accounting.post(new TxnCmd(req + ":I", AccountingService.T_TIME_INTEREST, null,
                    d.getAcctNo(), d.getInterest(), "定期到期利息 " + d.getDepositNo(),
                    "BATCH", "batch", acct.getBranchNo()), batchDate);
            d.setStatus(TimeDeposit.ST_MATURED);
            d.setPaidAt(LocalDateTime.now());
            depositMapper.updateById(d);
            n++;
        }
        return n;
    }

    public List<TimeDepositVO> list(Long customerId, String acctNo) {
        LambdaQueryWrapper<TimeDeposit> qw = new LambdaQueryWrapper<TimeDeposit>().orderByDesc(TimeDeposit::getId);
        if (acctNo != null && !acctNo.isBlank()) {
            qw.eq(TimeDeposit::getAcctNo, acctNo);
        } else if (customerId != null) {
            List<String> acctNos = com.airbank.core.service.QueryHelper.acctNosOf(accountService, customerId);
            if (acctNos.isEmpty()) {
                return List.of();
            }
            qw.in(TimeDeposit::getAcctNo, acctNos);
        }
        return depositMapper.selectList(qw).stream().map(this::toVo).toList();
    }

    public TimeDepositVO toVo(TimeDeposit d) {
        return new TimeDepositVO(d.getId(), d.getDepositNo(), d.getAcctNo(), d.getTermMonths(),
                d.getAnnualRate() == null ? null : d.getAnnualRate().toPlainString(), d.getAmount(),
                d.getValueDate() == null ? null : d.getValueDate().toString(),
                d.getMaturityDate() == null ? null : d.getMaturityDate().toString(),
                d.getInterest(), d.getStatus(), d.getPaidAt() == null ? null : d.getPaidAt().toString());
    }
}
