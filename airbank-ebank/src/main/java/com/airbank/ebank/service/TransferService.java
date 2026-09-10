package com.airbank.ebank.service;

import com.airbank.api.core.CoreClient;
import com.airbank.api.core.dto.AccountVO;
import com.airbank.api.core.dto.TxnCmd;
import com.airbank.api.core.dto.TxnVO;
import com.airbank.api.uam.UamClient;
import com.airbank.api.uam.dto.CustomerDTO;
import com.airbank.common.api.PageResult;
import com.airbank.common.exception.BizException;
import com.airbank.common.exception.ErrorCodes;
import com.airbank.common.util.Money;
import com.airbank.ebank.config.EbankParams;
import com.airbank.ebank.entity.EbankTxn;
import com.airbank.ebank.entity.Message;
import com.airbank.ebank.entity.TransferLimit;
import com.airbank.ebank.mapper.EbankTxnMapper;
import com.airbank.ebank.mapper.TransferLimitMapper;
import com.airbank.ebank.model.EbankTxnVO;
import com.airbank.ebank.model.LimitAdjustCmd;
import com.airbank.ebank.model.LimitVO;
import com.airbank.ebank.model.TransferCmd;
import com.airbank.ebank.model.TransferVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 网银转账（docs/design/05 §3.2）：OTP → 限额 → 本行收款校验 → 户名核对 → 本人付款账户 →
 * 落渠道流水（requestNo 幂等）→ 核心统一记账 INNER_TRANSFER → 回单 + 消息。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TransferService {

    public static final String SCENE_LIMIT = "LIMIT";
    public static final String SCENE_TRANSFER = "TRANSFER";

    private static final DateTimeFormatter TS = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final EbankTxnMapper txnMapper;
    private final TransferLimitMapper limitMapper;
    private final EbankParams params;
    private final CoreClient coreClient;
    private final UamClient uamClient;
    private final OtpService otpService;
    private final ReceiptService receiptService;
    private final MessageService messageService;

    // ---------- 限额 ----------

    /** GET /transfers/limit：客户限额懒创建（默认取全局参数），usedToday = 当日 SUCCESS 转账合计 */
    public LimitVO limit(Long customerId) {
        TransferLimit lim = lazyLimit(customerId);
        return new LimitVO(lim.getSingleLimit(), lim.getDailyLimit(), usedToday(customerId));
    }

    /** PUT /transfers/limit：仅下调免 OTP；上调须 OTP(scene=LIMIT) 校验通过（6002） */
    public LimitVO adjustLimit(Long customerId, LimitAdjustCmd cmd) {
        TransferLimit lim = lazyLimit(customerId);
        long single = fenOrNull(cmd.singleLimit(), lim.getSingleLimit(), "单笔限额");
        long daily = fenOrNull(cmd.dailyLimit(), lim.getDailyLimit(), "日累计限额");
        if (single <= 0 || daily <= 0) {
            throw BizException.of(ErrorCodes.PARAM_INVALID, "限额必须大于 0");
        }
        if (single > lim.getSingleLimit() || daily > lim.getDailyLimit()) {
            otpService.verifyOrThrow(customerId, SCENE_LIMIT, cmd.otpCode());
        }
        lim.setSingleLimit(single);
        lim.setDailyLimit(daily);
        limitMapper.updateById(lim);
        messageService.notify(customerId, Message.TYPE_SYS, "转账限额调整成功",
                "单笔限额 ¥" + Money.fenToYuanWithComma(single)
                        + "，单日累计限额 ¥" + Money.fenToYuanWithComma(daily) + "。");
        return new LimitVO(single, daily, usedToday(customerId));
    }

    // ---------- 转账 ----------

    public TransferVO transfer(Long customerId, TransferCmd cmd) {
        // 幂等：requestNo 唯一，重复请求返回原结果
        EbankTxn exist = txnMapper.selectOne(new LambdaQueryWrapper<EbankTxn>()
                .eq(EbankTxn::getRequestNo, cmd.requestNo()));
        if (exist != null) {
            return toVo(exist, null, null, true);
        }

        long amount = Money.yuanToFen(cmd.amount() == null ? null : cmd.amount().toPlainString());

        // OTP（先于一切资金动作）
        otpService.verifyOrThrow(customerId, SCENE_TRANSFER, cmd.otpCode());

        // 限额：单笔 / 日累计
        TransferLimit lim = lazyLimit(customerId);
        if (amount > lim.getSingleLimit()) {
            throw BizException.of(ErrorCodes.OVER_SINGLE_LIMIT,
                    "超出单笔限额 ¥" + Money.fenToYuanWithComma(lim.getSingleLimit()));
        }
        if (usedToday(customerId) + amount > lim.getDailyLimit()) {
            throw BizException.of(ErrorCodes.OVER_DAILY_LIMIT,
                    "超出当日累计限额 ¥" + Money.fenToYuanWithComma(lim.getDailyLimit()));
        }

        // 收款账号必须本行（6006）
        AccountVO toAcct;
        try {
            toAcct = OwnerGuard.data(coreClient.getAccount(cmd.toAcct().trim()));
        } catch (BizException e) {
            if (e.getCode() == ErrorCodes.ACCT_NOT_FOUND) {
                throw BizException.of(ErrorCodes.NOT_OUR_BANK, "仅支持本行收款账户");
            }
            throw e;
        }
        if (toAcct == null) {
            throw BizException.of(ErrorCodes.NOT_OUR_BANK, "仅支持本行收款账户");
        }

        // 户名核对（6005）
        CustomerDTO payee = OwnerGuard.data(uamClient.getCustomer(toAcct.customerId()));
        String expectName = payee == null ? null : payee.customerName();
        if (expectName == null || !expectName.equals(cmd.toName().trim())) {
            throw BizException.of(ErrorCodes.PAYEE_NAME_MISMATCH, "收款户名与账号不符");
        }

        // 付款账户归属校验（6008）
        AccountVO fromAcct = OwnerGuard.data(coreClient.getAccount(cmd.fromAcct().trim()));
        if (fromAcct == null || !customerId.equals(fromAcct.customerId())) {
            throw BizException.of(ErrorCodes.NOT_OWNER, "非本人账户，禁止转出");
        }

        // 落渠道流水 INIT
        EbankTxn txn = new EbankTxn();
        txn.setRequestNo(cmd.requestNo().trim());
        txn.setBizType(EbankTxn.BIZ_TRANSFER);
        txn.setCustomerId(customerId);
        txn.setAcctNo(fromAcct.acctNo());
        txn.setAmount(amount);
        txn.setStatus(EbankTxn.ST_INIT);
        txnMapper.insert(txn);

        // 核心统一记账（幂等：requestNo 全链路传递）
        TxnVO coreTxn;
        try {
            coreTxn = OwnerGuard.data(coreClient.postTxn(null, new TxnCmd(
                    cmd.requestNo().trim(), "INNER_TRANSFER",
                    fromAcct.acctNo(), toAcct.acctNo(), amount,
                    cmd.summary(), "EBANK", OwnerGuard.loginName(), null)));
        } catch (BizException e) {
            txn.setStatus(EbankTxn.ST_FAILED);
            txn.setFinishedAt(LocalDateTime.now());
            txnMapper.updateById(txn);
            Map<String, Object> content = receiptContent(customerId, txn, cmd.toAcct().trim(), cmd.toName(),
                    null, "转账失败：" + e.getMessage());
            String receiptNo = receiptService.create(customerId, EbankTxn.BIZ_TRANSFER, txn.getRequestNo(), content);
            messageService.notify(customerId, Message.TYPE_TXN, "转账失败",
                    "转出账户 " + fromAcct.acctNo() + " → " + toAcct.acctNo()
                            + "，金额 ¥" + Money.fenToYuan(amount) + " 失败：" + e.getMessage()
                            + "。回单号 " + receiptNo + "。");
            throw e;
        }

        txn.setStatus(EbankTxn.ST_SUCCESS);
        txn.setDownstreamNo(coreTxn.txnNo());
        txn.setFinishedAt(LocalDateTime.now());
        txnMapper.updateById(txn);

        Map<String, Object> content = receiptContent(customerId, txn, toAcct.acctNo(), expectName,
                coreTxn.txnNo(), "转账成功");
        String receiptNo = receiptService.create(customerId, EbankTxn.BIZ_TRANSFER, txn.getRequestNo(), content);
        messageService.notify(customerId, Message.TYPE_TXN, "转账成功",
                "您账户 " + fromAcct.acctNo() + " 于 " + TS.format(txn.getFinishedAt())
                        + " 向 " + expectName + "（" + toAcct.acctNo() + "）转账 ¥" + Money.fenToYuan(amount)
                        + " 成功，回单号 " + receiptNo + "。");

        return new TransferVO(txn.getRequestNo(), fromAcct.acctNo(), toAcct.acctNo(), expectName,
                amount, cmd.summary(), txn.getStatus(), coreTxn.txnNo(), receiptNo,
                coreTxn.fromBalanceAfter(),
                txn.getFinishedAt() == null ? null : TS.format(txn.getFinishedAt()), false);
    }

    /** GET /transfers：本人转账记录分页 */
    public PageResult<EbankTxnVO> page(Long customerId, int pageNum, int pageSize) {
        Page<EbankTxn> page = txnMapper.selectPage(new Page<>(pageNum, pageSize),
                new LambdaQueryWrapper<EbankTxn>()
                        .eq(EbankTxn::getCustomerId, customerId)
                        .eq(EbankTxn::getBizType, EbankTxn.BIZ_TRANSFER)
                        .orderByDesc(EbankTxn::getId));
        List<EbankTxnVO> list = page.getRecords().stream().map(t -> new EbankTxnVO(
                t.getId(), t.getRequestNo(), t.getBizType(), t.getAcctNo(), t.getAmount(),
                t.getStatus(), t.getDownstreamNo(),
                t.getCreatedAt() == null ? null : TS.format(t.getCreatedAt()),
                t.getFinishedAt() == null ? null : TS.format(t.getFinishedAt()))).toList();
        return new PageResult<>(list, page.getTotal(), pageNum, pageSize);
    }

    // ---------- 内部 ----------

    /** 元 → 分；null 保持原值（不调整）；非法输入 → 1001 */
    private long fenOrNull(java.math.BigDecimal yuan, long current, String label) {
        if (yuan == null) {
            return current;
        }
        try {
            return com.airbank.common.util.Money.yuanToFen(yuan.toPlainString());
        } catch (BizException e) {
            throw BizException.of(ErrorCodes.PARAM_INVALID, label + e.getMessage());
        }
    }

    /** 按客户懒创建限额记录，默认取全局参数 */
    private TransferLimit lazyLimit(Long customerId) {
        TransferLimit lim = limitMapper.selectOne(new LambdaQueryWrapper<TransferLimit>()
                .eq(TransferLimit::getCustomerId, customerId));
        if (lim != null) {
            return lim;
        }
        lim = new TransferLimit();
        lim.setCustomerId(customerId);
        lim.setSingleLimit(params.getEbankSingleLimit());
        lim.setDailyLimit(params.getEbankDailyLimit());
        try {
            limitMapper.insert(lim);
        } catch (org.springframework.dao.DuplicateKeyException e) {
            // 并发懒创建：回落为查询既有记录
            return limitMapper.selectOne(new LambdaQueryWrapper<TransferLimit>()
                    .eq(TransferLimit::getCustomerId, customerId));
        }
        return lim;
    }

    /** 日累计口径：当日 SUCCESS 的 EBANK 渠道转账合计（t_ebank_txn，跨渠道不共享） */
    private long usedToday(Long customerId) {
        List<EbankTxn> txns = txnMapper.selectList(new LambdaQueryWrapper<EbankTxn>()
                .eq(EbankTxn::getCustomerId, customerId)
                .eq(EbankTxn::getBizType, EbankTxn.BIZ_TRANSFER)
                .eq(EbankTxn::getStatus, EbankTxn.ST_SUCCESS)
                .ge(EbankTxn::getCreatedAt, LocalDate.now().atStartOfDay()));
        return txns.stream().mapToLong(EbankTxn::getAmount).sum();
    }

    private Map<String, Object> receiptContent(Long customerId, EbankTxn txn, String toAcct, String toName,
                                               String coreTxnNo, String resultDesc) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("issuer", "AirBank 网上银行");
        m.put("bizType", txn.getBizType());
        m.put("bizNo", txn.getRequestNo());
        m.put("requestNo", txn.getRequestNo());
        m.put("customerId", customerId);
        m.put("fromAcct", txn.getAcctNo());
        m.put("toAcct", toAcct);
        m.put("toName", toName);
        m.put("amountFen", txn.getAmount());
        m.put("amountYuan", Money.fenToYuan(txn.getAmount()));
        m.put("status", txn.getStatus());
        m.put("downstreamNo", coreTxnNo == null ? txn.getDownstreamNo() : coreTxnNo);
        m.put("channel", "EBANK");
        m.put("result", resultDesc);
        m.put("finishedAt", txn.getFinishedAt() == null ? null : TS.format(txn.getFinishedAt()));
        return m;
    }

    private TransferVO toVo(EbankTxn t, String receiptNo, Long fromBalanceAfter, boolean duplicated) {
        return new TransferVO(t.getRequestNo(), t.getAcctNo(), null, null, t.getAmount(), null,
                t.getStatus(), t.getDownstreamNo(), receiptNo, fromBalanceAfter,
                t.getFinishedAt() == null ? null : TS.format(t.getFinishedAt()), duplicated);
    }
}
