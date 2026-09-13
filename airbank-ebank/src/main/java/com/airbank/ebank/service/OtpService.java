package com.airbank.ebank.service;

import com.airbank.common.exception.BizException;
import com.airbank.common.exception.ErrorCodes;
import com.airbank.ebank.entity.Message;
import com.airbank.ebank.integration.UamCustomerClient;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * 网银 OTP 编排：发送（UAM 生成存 Redis 5 分钟）+ 落消息中心 + 培训环境"查看验证码"。
 */
@Service
@RequiredArgsConstructor
public class OtpService {

    private final UamCustomerClient uamCustomer;
    private final MessageService messageService;

    public void send(Long customerId, String scene) {
        OwnerGuard.data(uamCustomer.sendCustomerOtp(customerId, scene));
        // 模拟短信落消息中心（docs/design/05 §1.2）；已读脱敏由前端处理
        String code = latest(customerId, scene);
        messageService.notify(customerId, Message.TYPE_OTP, "短信验证码",
                "您正在办理【" + sceneLabel(scene) + "】，验证码 " + code + "，5 分钟内有效。"
                        + "请勿泄露给他人。（AirBank 培训环境模拟短信）");
    }

    /** 培训环境特性：查看本人最新验证码（ADR-8） */
    public String latest(Long customerId, String scene) {
        return OwnerGuard.data(uamCustomer.latestCustomerOtp(customerId, scene));
    }

    /** 校验并消费 OTP；失败/过期 → 6002 */
    public void verifyOrThrow(Long customerId, String scene, String code) {
        Boolean ok = OwnerGuard.data(uamCustomer.verifyCustomerOtp(customerId, scene, code));
        if (!Boolean.TRUE.equals(ok)) {
            throw BizException.of(ErrorCodes.OTP_INVALID, "短信验证码错误或已过期");
        }
    }

    private String sceneLabel(String scene) {
        return switch (scene == null ? "" : scene) {
            case "TRANSFER" -> "转账汇款";
            case "LIMIT" -> "限额调整";
            case "WEALTH" -> "理财申赎";
            case "LOAN" -> "贷款申请/还款";
            case "REGISTER" -> "网银注册";
            default -> scene == null ? "业务" : scene;
        };
    }
}
