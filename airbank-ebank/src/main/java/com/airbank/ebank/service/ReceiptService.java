package com.airbank.ebank.service;

import com.airbank.common.api.PageResult;
import com.airbank.common.exception.BizException;
import com.airbank.common.exception.ErrorCodes;
import com.airbank.ebank.entity.EReceipt;
import com.airbank.ebank.mapper.EReceiptMapper;
import com.airbank.ebank.model.ReceiptVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

/**
 * 电子回单：转账/理财申赎成功后生成防伪回单（docs/design/05 §3.4）。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ReceiptService {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final DateTimeFormatter TS = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final EReceiptMapper receiptMapper;

    /** 生成回单，返回防伪编号 receipt_no = "RCP" + 12 位随机数字 */
    public String create(Long customerId, String bizType, String bizNo, Map<String, Object> content) {
        EReceipt r = new EReceipt();
        r.setReceiptNo("RCP" + randomDigits());
        r.setCustomerId(customerId);
        r.setBizType(bizType);
        r.setBizNo(bizNo);
        r.setContent(content);
        receiptMapper.insert(r);
        return r.getReceiptNo();
    }

    public PageResult<ReceiptVO> page(Long customerId, int pageNum, int pageSize) {
        Page<EReceipt> page = receiptMapper.selectPage(new Page<>(pageNum, pageSize),
                new LambdaQueryWrapper<EReceipt>()
                        .eq(EReceipt::getCustomerId, customerId)
                        .orderByDesc(EReceipt::getId));
        List<ReceiptVO> list = page.getRecords().stream().map(r -> new ReceiptVO(
                r.getId(), r.getReceiptNo(), r.getBizType(), r.getBizNo(),
                r.getCreatedAt() == null ? null : r.getCreatedAt().format(TS), null)).toList();
        return new PageResult<>(list, page.getTotal(), pageNum, pageSize);
    }

    public ReceiptVO byReceiptNo(Long customerId, String receiptNo) {
        EReceipt r = receiptMapper.selectOne(new LambdaQueryWrapper<EReceipt>()
                .eq(EReceipt::getReceiptNo, receiptNo));
        if (r == null) {
            throw BizException.of(ErrorCodes.NOT_FOUND, "回单不存在");
        }
        if (!customerId.equals(r.getCustomerId())) {
            throw BizException.of(ErrorCodes.NOT_OWNER, "非本人回单，禁止查看");
        }
        return new ReceiptVO(r.getId(), r.getReceiptNo(), r.getBizType(), r.getBizNo(),
                r.getCreatedAt() == null ? null : r.getCreatedAt().format(TS), r.getContent());
    }

    private String randomDigits() {
        StringBuilder sb = new StringBuilder(12);
        for (int i = 0; i < 12; i++) {
            sb.append(RANDOM.nextInt(10));
        }
        return sb.toString();
    }
}
