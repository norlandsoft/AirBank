package com.airbank.ebank.service;

import com.airbank.common.exception.BizException;
import com.airbank.common.exception.ErrorCodes;
import com.airbank.ebank.entity.Beneficiary;
import com.airbank.ebank.mapper.BeneficiaryMapper;
import com.airbank.ebank.model.BeneficiaryCmd;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 收款人名册（P0，docs/design/05 §3.2）：常用收款人增删查，仅限本人。
 */
@Service
@RequiredArgsConstructor
public class BeneficiaryService {

    private final BeneficiaryMapper beneficiaryMapper;

    public List<Beneficiary> list(Long customerId) {
        return beneficiaryMapper.selectList(new LambdaQueryWrapper<Beneficiary>()
                .eq(Beneficiary::getCustomerId, customerId)
                .orderByDesc(Beneficiary::getId));
    }

    public Beneficiary add(Long customerId, BeneficiaryCmd cmd) {
        Beneficiary b = new Beneficiary();
        b.setCustomerId(customerId);
        b.setPayeeName(cmd.payeeName().trim());
        b.setPayeeAcct(cmd.payeeAcct().trim());
        b.setBankName(cmd.bankName() == null || cmd.bankName().isBlank() ? "AirBank" : cmd.bankName().trim());
        b.setAlias(cmd.alias() == null || cmd.alias().isBlank() ? null : cmd.alias().trim());
        try {
            beneficiaryMapper.insert(b);
        } catch (DuplicateKeyException e) {
            throw BizException.of(ErrorCodes.PARAM_INVALID, "该收款账号已在名册中");
        }
        return b;
    }

    public void delete(Long customerId, Long id) {
        Beneficiary b = beneficiaryMapper.selectById(id);
        if (b == null) {
            throw BizException.of(ErrorCodes.NOT_FOUND, "收款人不存在");
        }
        if (!customerId.equals(b.getCustomerId())) {
            throw BizException.of(ErrorCodes.NOT_OWNER, "非本人收款人，禁止删除");
        }
        beneficiaryMapper.deleteById(id);
    }
}
