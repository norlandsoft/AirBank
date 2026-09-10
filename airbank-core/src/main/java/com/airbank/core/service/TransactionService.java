package com.airbank.core.service;

import com.airbank.api.core.dto.TxnCmd;
import com.airbank.api.core.dto.TxnQuery;
import com.airbank.api.core.dto.TxnVO;
import com.airbank.common.api.PageResult;
import com.airbank.common.exception.BizException;
import com.airbank.common.exception.ErrorCodes;
import com.airbank.core.accounting.AccountingService;
import com.airbank.core.entity.Account;
import com.airbank.core.entity.Transaction;
import com.airbank.core.mapper.TransactionMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

/**
 * 交易域查询与冲正编排。
 */
@Service
@RequiredArgsConstructor
public class TransactionService {

    private final TransactionMapper transactionMapper;
    private final AccountingService accounting;
    private final AccountService accountService;

    public TxnVO post(TxnCmd cmd, String batchDateOrNull) {
        return accounting.post(cmd, parseDate(batchDateOrNull));
    }

    public TxnVO reverse(String txnNo, String requestNo, String operator, String channel,
                         String branchNo, String batchDateOrNull) {
        return accounting.reverse(txnNo, requestNo, operator, channel, branchNo, parseDate(batchDateOrNull));
    }

    public TxnVO byTxnNo(String txnNo) {
        Transaction t = transactionMapper.selectOne(
                new LambdaQueryWrapper<Transaction>().eq(Transaction::getTxnNo, txnNo));
        if (t == null) {
            throw BizException.of(ErrorCodes.NOT_FOUND, "交易流水不存在");
        }
        return accounting.toVo(t, false);
    }

    public PageResult<TxnVO> page(TxnQuery q) {
        LambdaQueryWrapper<Transaction> qw = new LambdaQueryWrapper<Transaction>()
                .orderByDesc(Transaction::getId);
        if (q.getAcctNo() != null && !q.getAcctNo().isBlank()) {
            qw.and(w -> w.eq(Transaction::getFromAcct, q.getAcctNo())
                    .or().eq(Transaction::getToAcct, q.getAcctNo()));
        }
        if (q.getCustomerId() != null) {
            List<String> acctNos = QueryHelper.acctNosOf(accountService, q.getCustomerId());
            if (acctNos.isEmpty()) {
                return new PageResult<>(List.of(), 0, q.getPageNum(), q.getPageSize());
            }
            qw.and(w -> w.in(Transaction::getFromAcct, acctNos).or().in(Transaction::getToAcct, acctNos));
        }
        if (q.getTxnType() != null && !q.getTxnType().isBlank()) {
            qw.eq(Transaction::getTxnType, q.getTxnType());
        }
        if (q.getChannel() != null && !q.getChannel().isBlank()) {
            qw.eq(Transaction::getChannel, q.getChannel());
        }
        if (q.getStatus() != null && !q.getStatus().isBlank()) {
            qw.eq(Transaction::getStatus, q.getStatus());
        }
        if (q.getBeginDate() != null && !q.getBeginDate().isBlank()) {
            qw.ge(Transaction::getBatchDate, LocalDate.parse(q.getBeginDate()));
        }
        if (q.getEndDate() != null && !q.getEndDate().isBlank()) {
            qw.le(Transaction::getBatchDate, LocalDate.parse(q.getEndDate()));
        }
        Page<Transaction> page = transactionMapper.selectPage(new Page<>(q.getPageNum(), q.getPageSize()), qw);
        List<TxnVO> list = page.getRecords().stream().map(t -> accounting.toVo(t, false)).toList();
        return new PageResult<>(list, page.getTotal(), q.getPageNum(), q.getPageSize());
    }

    /** 柜面冲正：校验原交易操作人权限留给渠道；核心校验当日与状态 */
    public TxnVO reverseByCounter(String txnNo, String requestNo, String operator, String branchNo) {
        return accounting.reverse(txnNo, requestNo, operator, channelOf(operator), branchNo, LocalDate.now());
    }

    private String channelOf(String operator) {
        return "COUNTER";
    }

    private LocalDate parseDate(String dateOrNull) {
        return dateOrNull == null || dateOrNull.isBlank() ? LocalDate.now() : LocalDate.parse(dateOrNull);
    }
}
