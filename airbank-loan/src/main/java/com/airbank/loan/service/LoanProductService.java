package com.airbank.loan.service;

import com.airbank.api.loan.dto.LoanProductVO;
import com.airbank.common.exception.BizException;
import com.airbank.common.exception.ErrorCodes;
import com.airbank.loan.entity.LoanProduct;
import com.airbank.loan.mapper.LoanProductMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 贷款产品服务（docs/design/13 §2）。
 */
@Service
@RequiredArgsConstructor
public class LoanProductService {

    private final LoanProductMapper productMapper;

    public List<LoanProductVO> list(String status) {
        LambdaQueryWrapper<LoanProduct> qw = new LambdaQueryWrapper<LoanProduct>()
                .orderByAsc(LoanProduct::getProductCode);
        if (status != null && !status.isBlank()) {
            qw.eq(LoanProduct::getStatus, status);
        }
        return productMapper.selectList(qw).stream().map(LoanProductService::toVo).toList();
    }

    public LoanProduct require(String code) {
        LoanProduct p = productMapper.selectOne(new LambdaQueryWrapper<LoanProduct>()
                .eq(LoanProduct::getProductCode, code));
        if (p == null) {
            throw BizException.of(ErrorCodes.LOAN_PRODUCT_NOT_FOUND, "贷款产品不存在: " + code);
        }
        return p;
    }

    /** 在售产品（申请入口校验） */
    public LoanProduct requireOnSale(String code) {
        LoanProduct p = require(code);
        if (!LoanProduct.ST_ON_SALE.equals(p.getStatus())) {
            throw BizException.of(ErrorCodes.LOAN_PRODUCT_UNAVAILABLE,
                    "产品当前状态 " + p.getStatus() + "，暂不可申请");
        }
        return p;
    }

    public static LoanProductVO toVo(LoanProduct p) {
        return new LoanProductVO(p.getProductCode(), p.getProductName(), p.getDescription(),
                p.getMinAmount(), p.getMaxAmount(), p.getTermOptions(), p.getAnnualRate(),
                p.getRepayMethod(), p.getMinScore(), p.getStatus());
    }
}
