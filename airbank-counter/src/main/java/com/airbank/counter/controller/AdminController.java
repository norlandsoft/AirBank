package com.airbank.counter.controller;

import com.airbank.api.core.CoreClient;
import com.airbank.api.core.dto.BatchVO;
import com.airbank.api.core.dto.OpenAccountCmd;
import com.airbank.api.uam.UamClient;
import com.airbank.api.uam.dto.CustomerCreateCmd;
import com.airbank.api.uam.dto.CustomerDTO;
import com.airbank.api.wealth.WealthClient;
import com.airbank.common.api.Result;
import com.airbank.common.exception.BizException;
import com.airbank.common.exception.ErrorCodes;
import com.airbank.common.security.AuthContext;
import com.airbank.common.security.AuthUser;
import com.airbank.common.security.RequirePerm;
import com.airbank.counter.config.CounterParams;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

/**
 * 系统管理（admin，docs/design/05 §2.3）：批量触发、参数查看、造数。
 */
@Slf4j
@RestController
@RequestMapping("/admin")
@RequiredArgsConstructor
@RequirePerm("admin:manage")
public class AdminController {

    private final CoreClient coreClient;
    private final WealthClient wealthClient;
    private final UamClient uamClient;
    private final CounterParams params;

    /** 触发核心日终批量 */
    @PostMapping("/batch/day-end")
    public Result<BatchVO> triggerDayEnd(@RequestParam(required = false) String date) {
        return coreClient.triggerDayEnd(date);
    }

    /** 理财批量：type = confirm | accrual | settle | recon */
    @PostMapping("/batch/wealth")
    public Result<String> triggerWealth(@RequestParam String type,
                                        @RequestParam(required = false) String date) {
        return switch (type) {
            case "confirm" -> wealthClient.triggerConfirm(date);
            case "accrual" -> wealthClient.triggerAccrual(date);
            case "settle" -> wealthClient.triggerSettle(date);
            case "recon" -> wealthClient.triggerRecon(date);
            default -> throw BizException.of(ErrorCodes.PARAM_INVALID,
                    "不支持的批量类型: " + type + "（confirm/accrual/settle/recon）");
        };
    }

    @GetMapping("/params")
    public Result<Map<String, Object>> params() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("authorizeThreshold", params.getAuthorizeThreshold());
        m.put("cashBoxLimit", params.getCashBoxLimit());
        return Result.ok(m);
    }

    /** 造数：随机客户 + 活期账户（随机初始存款 100.00~1,000,000.00 元），异常跳过继续 */
    @PostMapping("/factory/customers")
    public Result<Map<String, Object>> factoryCustomers(@RequestBody Map<String, Object> body) {
        int count = 0;
        Object raw = body == null ? null : body.get("count");
        if (raw instanceof Number n) {
            count = n.intValue();
        } else if (raw != null) {
            try {
                count = Integer.parseInt(String.valueOf(raw));
            } catch (NumberFormatException ignore) {
                // 保持 0，走下方校验
            }
        }
        if (count < 1 || count > 200) {
            throw BizException.of(ErrorCodes.PARAM_INVALID, "count 须在 1~200 之间");
        }
        AuthUser user = AuthContext.require();
        String branchNo = user.branchNo() == null || user.branchNo().isBlank() ? "990" : user.branchNo();
        String operator = user.tellerNo() == null || user.tellerNo().isBlank() ? user.loginName() : user.tellerNo();

        long ts = System.currentTimeMillis();
        int created = 0;
        int failed = 0;
        for (int i = 1; i <= count; i++) {
            try {
                // 证件号："9" + 13 位时间戳 + 3 位序号 = 17 位数字，保证唯一
                String idNo = "9" + ts + String.format("%03d", i);
                String mobile = "139" + String.format("%08d", ThreadLocalRandom.current().nextInt(100_000_000));
                CustomerDTO c = uamClient.createCustomer(new CustomerCreateCmd(
                        "测试客户" + i, "ID_CARD", idNo, mobile, null, null, null)).getData();
                long initAmount = ThreadLocalRandom.current().nextLong(100_00L, 1_000_000_00L + 1);
                coreClient.openAccount(new OpenAccountCmd(
                        "FAC" + ts + String.format("%03d", i), c.id(), "DEMAND",
                        initAmount, branchNo, operator, "COUNTER"));
                created++;
            } catch (Exception e) {
                failed++;
                log.warn("factory customer {} failed: {}", i, e.getMessage());
            }
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("requested", count);
        out.put("created", created);
        out.put("failed", failed);
        return Result.ok(out);
    }
}
