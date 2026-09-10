package com.airbank.counter.service;

import com.airbank.api.core.CoreClient;
import com.airbank.api.core.dto.AccountVO;
import com.airbank.api.uam.UamClient;
import com.airbank.api.uam.dto.CustomerDTO;
import com.airbank.api.wealth.WealthClient;
import com.airbank.api.wealth.dto.ProductVO;
import com.airbank.common.api.Result;
import com.airbank.common.exception.BizException;
import com.airbank.common.exception.ErrorCodes;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Supplier;

/**
 * 渠道查询代理：账户（核心）/ 客户（用户中心，按客户号→证件号依次尝试）/ 理财产品。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ChannelQueryService {

    private final CoreClient coreClient;
    private final UamClient uamClient;
    private final WealthClient wealthClient;

    public AccountVO account(String acctNo) {
        return data(() -> coreClient.getAccount(acctNo));
    }

    /** 柜面客户查询：keyword 依次按客户号、证件号尝试，命中即返回单元素列表 */
    public List<CustomerDTO> customerByKeyword(String keyword) {
        List<CustomerDTO> out = new ArrayList<>();
        CustomerDTO byNo = tryCustomer(() -> uamClient.getByCustomerNo(keyword));
        if (byNo != null) {
            out.add(byNo);
            return out;
        }
        CustomerDTO byIdNo = tryCustomer(() -> uamClient.getByIdNo(keyword));
        if (byIdNo != null) {
            out.add(byIdNo);
        }
        return out;
    }

    public List<ProductVO> productsOnSale() {
        return data(() -> wealthClient.listProducts("ON_SALE"));
    }

    private CustomerDTO tryCustomer(Supplier<Result<CustomerDTO>> call) {
        try {
            Result<CustomerDTO> r = call.get();
            return r != null && r.isOk() ? r.getData() : null;
        } catch (BizException e) {
            if (e.getCode() == ErrorCodes.CUSTOMER_NOT_FOUND) {
                return null;
            }
            throw e;
        }
    }

    private <T> T data(Supplier<Result<T>> call) {
        Result<T> r = call.get();
        return r == null ? null : r.getData();
    }
}
