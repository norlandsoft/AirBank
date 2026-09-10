package com.airbank.uam.controller;

import com.airbank.common.api.Result;
import com.airbank.common.exception.BizException;
import com.airbank.common.exception.ErrorCodes;
import com.airbank.common.security.AuthContext;
import com.airbank.common.security.AuthUser;
import com.airbank.uam.model.RiskSubmitCmd;
import com.airbank.uam.service.RiskService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/risk-assessments")
@RequiredArgsConstructor
public class RiskController {

    private final RiskService riskService;

    public record RiskLevelVO(String level, Integer score) {
    }

    /** 提交测评：网银客户只能为本人测评；柜面可为任意客户 */
    @PostMapping
    public Result<String> submit(@RequestBody RiskSubmitCmd cmd) {
        AuthUser user = AuthContext.require();
        if (user.customerId() != null && !user.customerId().equals(cmd.customerId())) {
            throw BizException.of(ErrorCodes.NOT_OWNER, "仅可为本人完成测评");
        }
        return Result.ok(riskService.submit(cmd));
    }

    @GetMapping("/latest")
    public Result<RiskLevelVO> latest(@RequestParam Long customerId) {
        var latest = riskService.latest(customerId);
        return Result.ok(latest == null ? new RiskLevelVO(null, null)
                : new RiskLevelVO(latest.getLevel(), latest.getScore()));
    }
}
