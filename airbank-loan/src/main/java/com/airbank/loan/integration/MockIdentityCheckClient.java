package com.airbank.loan.integration;

import com.airbank.loan.entity.ExtCheckLog;
import com.airbank.loan.mapper.ExtCheckLogMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

/**
 * 联网核查 mock 实现（docs/design/13 §6.1）。
 * 规则（确定性，可重复演示）：
 *  - 默认一律核查通过（公民身份号码与姓名一致）；
 *  - 培训触发词：姓名含 "核查失败" → 返回 MISMATCH（用于演示核查不通过拒绝链路）。
 */
@Slf4j
@Primary
@Component
@RequiredArgsConstructor
public class MockIdentityCheckClient implements IdentityCheckClient {

    private final ExtCheckLogMapper logMapper;

    @Override
    public IdCheckResult verify(IdCheckRequest req) {
        boolean pass = req.customerName() == null || !req.customerName().contains("核查失败");
        String result = pass ? "PASS" : "MISMATCH";
        String detail = pass
                ? "公民身份号码与姓名一致（mock 联网核查，渠道 MOCK-NCIIC）"
                : "公民身份号码与姓名不一致（mock 联网核查触发词）";
        ExtCheckLog row = new ExtCheckLog();
        row.setBizNo(req.applyNo());
        row.setCheckType(ExtCheckLog.TYPE_ID_VERIFY);
        row.setRequestText("name=" + req.customerName() + ", idNo=" + mask(req.idNo()));
        row.setResponseText("{\"result\":\"" + result + "\",\"detail\":\"" + detail + "\"}");
        row.setResult(result);
        row.setCreatedAt(LocalDateTime.now());
        logMapper.insert(row);
        log.info("[ext-mock] id-verify {} -> {}", req.applyNo(), result);
        return new IdCheckResult(pass, result, detail);
    }

    private String mask(String idNo) {
        if (idNo == null || idNo.length() < 8) {
            return "***";
        }
        return idNo.substring(0, 4) + "**********" + idNo.substring(idNo.length() - 4);
    }
}
