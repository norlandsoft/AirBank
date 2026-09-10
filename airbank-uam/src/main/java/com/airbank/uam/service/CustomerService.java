package com.airbank.uam.service;

import com.airbank.api.uam.dto.CustomerCreateCmd;
import com.airbank.api.uam.dto.CustomerDTO;
import com.airbank.common.exception.BizException;
import com.airbank.common.exception.ErrorCodes;
import com.airbank.common.security.SecurityProperties;
import com.airbank.common.util.AesGcm;
import com.airbank.common.util.Desensitize;
import com.airbank.uam.entity.Customer;
import com.airbank.uam.mapper.CustomerMapper;
import com.airbank.uam.mapper.SeqMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.format.DateTimeFormatter;
import java.util.HexFormat;

/**
 * 客户主数据：证件号唯一（SHA-256 哈希等值查询）+ AES-GCM 加密存储 + 脱敏列（docs/design/08 §2）。
 */
@Service
@RequiredArgsConstructor
public class CustomerService {

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    private final CustomerMapper customerMapper;
    private final SeqMapper seqMapper;
    private final SecurityProperties securityProps;

    public CustomerDTO create(CustomerCreateCmd cmd) {
        String idHash = sha256(cmd.idNo());
        if (customerMapper.selectCount(new LambdaQueryWrapper<Customer>().eq(Customer::getIdNoHash, idHash)) > 0) {
            throw BizException.of(ErrorCodes.CUSTOMER_EXISTS, "该证件号已开户");
        }
        Customer c = new Customer();
        c.setCustomerNo("10" + String.format("%010d", seqMapper.nextval("seq_customer")));
        c.setCustomerName(cmd.customerName());
        c.setIdType(cmd.idType() == null ? "01" : cmd.idType());
        c.setIdNoEnc(AesGcm.encrypt(cmd.idNo(), securityProps.getAesKey()));
        c.setIdNoHash(idHash);
        c.setIdNoMask(Desensitize.idNo(cmd.idNo()));
        c.setMobileEnc(AesGcm.encrypt(cmd.mobile(), securityProps.getAesKey()));
        c.setMobileHash(sha256(cmd.mobile()));
        c.setMobileMask(Desensitize.mobile(cmd.mobile()));
        c.setGender(cmd.gender());
        c.setOccupation(cmd.occupation());
        c.setAddress(cmd.address());
        c.setStatus("NORMAL");
        customerMapper.insert(c);
        return toDto(c);
    }

    public CustomerDTO toDto(Customer c) {
        return new CustomerDTO(c.getId(), c.getCustomerNo(), c.getCustomerName(), c.getIdType(),
                c.getIdNoMask(), c.getMobileMask(), c.getGender(), c.getOccupation(), c.getAddress(),
                c.getRiskLevel(), c.getRiskAssessDate() == null ? null : c.getRiskAssessDate().format(DATE),
                c.getStatus());
    }

    public Customer requireEntity(Long id) {
        Customer c = customerMapper.selectById(id);
        if (c == null) {
            throw BizException.of(ErrorCodes.CUSTOMER_NOT_FOUND, "客户不存在");
        }
        return c;
    }

    public Customer byIdNo(String idNo) {
        return customerMapper.selectOne(new LambdaQueryWrapper<Customer>().eq(Customer::getIdNoHash, sha256(idNo)));
    }

    public Customer byCustomerNo(String customerNo) {
        return customerMapper.selectOne(new LambdaQueryWrapper<Customer>().eq(Customer::getCustomerNo, customerNo));
    }

    public Page<Customer> page(int pageNum, int pageSize, String keyword) {
        LambdaQueryWrapper<Customer> qw = new LambdaQueryWrapper<Customer>().orderByDesc(Customer::getId);
        if (StringUtils.hasText(keyword)) {
            qw.and(w -> w.like(Customer::getCustomerName, keyword)
                    .or().like(Customer::getCustomerNo, keyword)
                    .or().like(Customer::getMobileMask, keyword)
                    .or().like(Customer::getIdNoMask, keyword));
        }
        return customerMapper.selectPage(new Page<>(pageNum, pageSize), qw);
    }

    public CustomerDTO update(Long id, CustomerCreateCmd cmd) {
        Customer c = requireEntity(id);
        c.setCustomerName(cmd.customerName());
        c.setGender(cmd.gender());
        c.setOccupation(cmd.occupation());
        c.setAddress(cmd.address());
        customerMapper.updateById(c);
        return toDto(c);
    }

    public String riskLevel(Long customerId) {
        Customer c = requireEntity(customerId);
        return c.getRiskLevel() == null ? "" : c.getRiskLevel();
    }

    private String sha256(String value) {
        try {
            byte[] d = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(d);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
