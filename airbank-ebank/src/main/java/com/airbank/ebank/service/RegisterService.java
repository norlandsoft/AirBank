package com.airbank.ebank.service;

import com.airbank.api.uam.UamClient;
import com.airbank.api.uam.dto.CustomerDTO;
import com.airbank.common.exception.BizException;
import com.airbank.common.exception.ErrorCodes;
import com.airbank.common.util.Desensitize;
import com.airbank.ebank.integration.UamCustomerClient;
import com.airbank.ebank.integration.UamRegisterClient;
import com.airbank.ebank.model.RegisterCheckCmd;
import com.airbank.ebank.model.RegisterCheckVO;
import com.airbank.ebank.model.RegisterCmd;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

/**
 * 网银自助注册（docs/design/05 §3.1）：
 * 仅已开户且预留手机号匹配的客户可注册；OTP 校验通过后创建 CUSTOMER 登录用户。
 * /register/** 在网关与本服务的安全白名单内（未登录态）。
 */
@Service
@RequiredArgsConstructor
public class RegisterService {

    public static final String SCENE_REGISTER = "REGISTER";

    private final UamClient uamClient;
    private final UamCustomerClient uamCustomer;
    private final UamRegisterClient uamRegister;

    /** POST /register/check：校验客户存在 + 手机号匹配 → 发 OTP，返回脱敏客户信息 */
    public RegisterCheckVO check(RegisterCheckCmd cmd) {
        CustomerDTO c = requireByCustomerNoAndMobile(cmd.customerNo(), cmd.mobile());
        OwnerGuard.data(uamCustomer.sendCustomerOtp(c.id(), SCENE_REGISTER));
        return new RegisterCheckVO(c.id(), Desensitize.name(c.customerName()), c.mobileMask());
    }

    /** POST /register：完成注册，创建 CUSTOMER 用户（关联 customerId，默认角色 EBANK_USER） */
    public boolean register(RegisterCmd cmd) {
        CustomerDTO c = requireByCustomerNoAndMobile(cmd.customerNo(), cmd.mobile());
        Boolean otpOk = OwnerGuard.data(uamCustomer.verifyCustomerOtp(c.id(), SCENE_REGISTER, cmd.otpCode()));
        if (!Boolean.TRUE.equals(otpOk)) {
            throw BizException.of(ErrorCodes.OTP_INVALID, "短信验证码错误或已过期");
        }
        checkPasswordPolicy(cmd.password());
        // 局部契约扩展：UAM /internal/users/customer-register
        Map<String, Object> body = new HashMap<>();
        body.put("customerId", c.id());
        body.put("loginName", cmd.loginName().trim());
        body.put("password", cmd.password());
        OwnerGuard.data(uamRegister.register(body));
        return true;
    }

    /** POST /register/otp-latest：培训环境"查看验证码"（未登录态，仅 REGISTER 场景） */
    public String latestOtp(String customerNo) {
        if (customerNo == null || customerNo.isBlank()) {
            throw BizException.of(ErrorCodes.PARAM_INVALID, "客户号不能为空");
        }
        com.airbank.common.api.Result<CustomerDTO> r = uamClient.getByCustomerNo(customerNo.trim());
        CustomerDTO c = r != null && r.isOk() ? r.getData() : null;
        if (c == null) {
            throw BizException.of(ErrorCodes.REGISTER_MISMATCH, "客户号不存在或尚未开户");
        }
        return OwnerGuard.data(uamCustomer.latestCustomerOtp(c.id(), SCENE_REGISTER));
    }

    /** 客户存在（6001）+ 预留手机号匹配（6001） */
    private CustomerDTO requireByCustomerNoAndMobile(String customerNo, String mobile) {
        if (customerNo == null || customerNo.isBlank() || mobile == null || mobile.isBlank()) {
            throw BizException.of(ErrorCodes.PARAM_INVALID, "客户号与手机号不能为空");
        }
        com.airbank.common.api.Result<CustomerDTO> r = uamClient.getByCustomerNo(customerNo.trim());
        CustomerDTO c = r != null && r.isOk() ? r.getData() : null;
        if (c == null) {
            throw BizException.of(ErrorCodes.REGISTER_MISMATCH, "客户号不存在或尚未开户");
        }
        Boolean mobileOk = OwnerGuard.data(uamCustomer.verifyMobile(c.id(), mobile.trim()));
        if (!Boolean.TRUE.equals(mobileOk)) {
            throw BizException.of(ErrorCodes.REGISTER_MISMATCH, "预留手机号不匹配");
        }
        return c;
    }

    /** 密码策略：8~20 位，须同时包含字母和数字（docs/design/05 §3.1） */
    private void checkPasswordPolicy(String password) {
        if (password == null || password.length() < 8 || password.length() > 20
                || !password.matches(".*[A-Za-z].*") || !password.matches(".*\\d.*")) {
            throw BizException.of(ErrorCodes.PARAM_INVALID, "密码须为 8~20 位且同时包含字母和数字");
        }
    }
}
