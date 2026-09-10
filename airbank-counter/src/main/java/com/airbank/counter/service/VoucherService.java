package com.airbank.counter.service;

import com.airbank.common.exception.BizException;
import com.airbank.common.exception.ErrorCodes;
import com.airbank.counter.entity.CounterTxn;
import com.airbank.counter.entity.Voucher;
import com.airbank.counter.mapper.CounterTxnMapper;
import com.airbank.counter.mapper.VoucherMapper;
import com.airbank.counter.model.VoucherVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 回执：每笔 POSTED 申请单生成结构化回执（voucher_no = VCH + 12 位随机大写字母数字），
 * content 含业务要素 + 户名 + 金额 + 流水号 + "AirBank 培训环境专用"行章标识（docs/design/05 §2.2）。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class VoucherService {

    private static final String CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final DateTimeFormatter TS = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    /** 业务类型中文名（回执展示） */
    private static final Map<String, String> BIZ_NAMES = Map.ofEntries(
            Map.entry(CounterTxn.BIZ_ACCOUNT_OPEN, "开户"),
            Map.entry(CounterTxn.BIZ_CASH_DEPOSIT, "现金存款"),
            Map.entry(CounterTxn.BIZ_CASH_WITHDRAW, "现金取款"),
            Map.entry(CounterTxn.BIZ_INNER_TRANSFER, "行内转账"),
            Map.entry(CounterTxn.BIZ_TIME_DEPOSIT_IN, "定期存入"),
            Map.entry(CounterTxn.BIZ_TIME_DEPOSIT_BREAK, "定期支取"),
            Map.entry(CounterTxn.BIZ_WEALTH_SUBSCRIBE, "理财申购"),
            Map.entry(CounterTxn.BIZ_WEALTH_REDEEM, "理财赎回"),
            Map.entry(CounterTxn.BIZ_ACCOUNT_FREEZE, "账户冻结"),
            Map.entry(CounterTxn.BIZ_ACCOUNT_UNFREEZE, "账户解冻"),
            Map.entry(CounterTxn.BIZ_ACCOUNT_CLOSE, "账户销户"),
            Map.entry(CounterTxn.BIZ_REVERSE, "差错冲正"));

    private final VoucherMapper voucherMapper;
    private final CounterTxnMapper txnMapper;

    @Transactional
    public Voucher generate(CounterTxn txn) {
        Voucher voucher = new Voucher();
        voucher.setCtTxnId(txn.getId());
        voucher.setVoucherNo(nextVoucherNo());
        voucher.setVoucherType(txn.getBizType());
        voucher.setContent(buildContent(txn, voucher.getVoucherNo()));
        voucher.setGeneratedAt(LocalDateTime.now());
        voucherMapper.insert(voucher);
        return voucher;
    }

    /** 按日查询回执（含申请单号） */
    public List<VoucherVO> list(LocalDate date) {
        List<CounterTxn> txns = txnMapper.selectList(new LambdaQueryWrapper<CounterTxn>()
                .eq(CounterTxn::getShiftDate, date));
        if (txns.isEmpty()) {
            return List.of();
        }
        Map<Long, String> ctNos = txns.stream()
                .collect(Collectors.toMap(CounterTxn::getId, CounterTxn::getCtNo, (a, b) -> a));
        List<Voucher> vouchers = voucherMapper.selectList(new LambdaQueryWrapper<Voucher>()
                .in(Voucher::getCtTxnId, ctNos.keySet())
                .orderByAsc(Voucher::getId));
        return vouchers.stream()
                .map(v -> toVo(v, ctNos.get(v.getCtTxnId())))
                .toList();
    }

    public VoucherVO byVoucherNo(String voucherNo) {
        Voucher voucher = voucherMapper.selectOne(new LambdaQueryWrapper<Voucher>()
                .eq(Voucher::getVoucherNo, voucherNo));
        if (voucher == null) {
            throw BizException.of(ErrorCodes.NOT_FOUND, "回执不存在");
        }
        CounterTxn txn = txnMapper.selectById(voucher.getCtTxnId());
        return toVo(voucher, txn == null ? null : txn.getCtNo());
    }

    private VoucherVO toVo(Voucher v, String ctNo) {
        return new VoucherVO(v.getId(), v.getCtTxnId(), ctNo, v.getVoucherNo(),
                v.getVoucherType(), v.getContent(), v.getGeneratedAt());
    }

    private Map<String, Object> buildContent(CounterTxn txn, String voucherNo) {
        Map<String, Object> payload = txn.getPayload() == null ? Map.of() : txn.getPayload();
        Map<String, Object> result = txn.getResult() == null ? Map.of() : txn.getResult();

        Map<String, Object> c = new LinkedHashMap<>();
        c.put("voucherNo", voucherNo);
        c.put("ctNo", txn.getCtNo());
        c.put("bizType", txn.getBizType());
        c.put("bizTypeName", BIZ_NAMES.getOrDefault(txn.getBizType(), txn.getBizType()));
        // 业务要素
        putIfNotNull(c, "acctNo", firstNonNull(payload.get("acctNo"), result.get("acctNo")));
        putIfNotNull(c, "toAcct", firstNonNull(payload.get("toAcct"), result.get("toAcct")));
        putIfNotNull(c, "depositNo", firstNonNull(payload.get("depositNo"), result.get("depositNo")));
        putIfNotNull(c, "productCode", firstNonNull(payload.get("productCode"), result.get("productCode")));
        // 户名（开户带 customerCmd、理财带 customerId 时尽力获取）
        putIfNotNull(c, "customerName", firstNonNull(payload.get("customerName"),
                customerNameOf(payload)));
        // 金额（分 + 元）
        c.put("amount", txn.getAmount() == null ? 0L : txn.getAmount());
        c.put("amountYuan", com.airbank.common.util.Money
                .fenToYuan(txn.getAmount() == null ? 0L : txn.getAmount()));
        // 流水号（下游核心/理财返回）
        putIfNotNull(c, "txnNo", result.get("txnNo"));
        putIfNotNull(c, "orderNo", result.get("orderNo"));
        putIfNotNull(c, "cardNo", result.get("cardNo"));
        // 经办要素
        putIfNotNull(c, "tellerNo", txn.getTellerNo());
        putIfNotNull(c, "branchNo", txn.getBranchNo());
        putIfNotNull(c, "requestNo", txn.getRequestNo());
        putIfNotNull(c, "reviewerNo", txn.getReviewerNo());
        c.put("generatedAt", LocalDateTime.now().format(TS));
        // 行章标识
        c.put("mark", "AirBank 培训环境专用");
        return c;
    }

    @SuppressWarnings("unchecked")
    private String customerNameOf(Map<String, Object> payload) {
        Object cmd = payload.get("customerCmd");
        if (cmd instanceof Map<?, ?> m && m.get("customerName") != null) {
            return String.valueOf(m.get("customerName"));
        }
        return null;
    }

    private Object firstNonNull(Object a, Object b) {
        return a != null ? a : b;
    }

    private void putIfNotNull(Map<String, Object> map, String key, Object value) {
        if (value != null) {
            map.put(key, value);
        }
    }

    private String nextVoucherNo() {
        // 撞唯一约束概率极低，兜底重试 3 次
        for (int attempt = 0; attempt < 3; attempt++) {
            String no = "VCH" + random12();
            Long count = voucherMapper.selectCount(new LambdaQueryWrapper<Voucher>()
                    .eq(Voucher::getVoucherNo, no));
            if (count == null || count == 0) {
                return no;
            }
        }
        throw BizException.of(ErrorCodes.SYSTEM_ERROR, "回执编号生成失败，请重试");
    }

    private String random12() {
        StringBuilder sb = new StringBuilder(12);
        for (int i = 0; i < 12; i++) {
            sb.append(CHARS.charAt(RANDOM.nextInt(CHARS.length())));
        }
        return sb.toString();
    }
}
