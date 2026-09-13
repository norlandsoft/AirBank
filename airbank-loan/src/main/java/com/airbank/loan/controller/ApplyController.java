package com.airbank.loan.controller;

import com.airbank.api.loan.dto.LoanApplicationVO;
import com.airbank.api.loan.dto.LoanApplyCmd;
import com.airbank.common.api.Result;
import com.airbank.loan.service.ApplyService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 贷款申请（docs/design/13 §4.2）：受理后同步完成 联网核查 → 征信 → 自动审批 → 放款。
 */
@RestController
@RequestMapping("/applications")
@RequiredArgsConstructor
public class ApplyController {

    private final ApplyService applyService;

    @PostMapping
    public Result<LoanApplicationVO> apply(@RequestBody LoanApplyCmd cmd) {
        return Result.ok(applyService.apply(cmd));
    }

    @GetMapping
    public Result<List<LoanApplicationVO>> list(@RequestParam("customerId") Long customerId) {
        return Result.ok(applyService.listByCustomer(customerId));
    }

    @GetMapping("/{applyNo}")
    public Result<LoanApplicationVO> get(@PathVariable("applyNo") String applyNo) {
        return Result.ok(applyService.byApplyNo(applyNo));
    }
}
