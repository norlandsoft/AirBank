package com.airbank.loan.controller;

import com.airbank.api.loan.dto.LoanAccountVO;
import com.airbank.api.loan.dto.LoanDetailVO;
import com.airbank.api.loan.dto.LoanRepayCmd;
import com.airbank.api.loan.dto.LoanRepaymentVO;
import com.airbank.common.api.Result;
import com.airbank.loan.service.LoanQueryService;
import com.airbank.loan.service.RepayService;
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
 * 借据与还款（docs/design/13 §4.5/§4.6）。
 */
@RestController
@RequestMapping("/loans")
@RequiredArgsConstructor
public class LoanController {

    private final LoanQueryService queryService;
    private final RepayService repayService;

    @GetMapping
    public Result<List<LoanAccountVO>> list(@RequestParam("customerId") Long customerId) {
        return Result.ok(queryService.listByCustomer(customerId));
    }

    @GetMapping("/{loanNo}")
    public Result<LoanDetailVO> detail(@PathVariable("loanNo") String loanNo) {
        return Result.ok(queryService.detail(loanNo));
    }

    @PostMapping("/repay")
    public Result<LoanRepaymentVO> repay(@RequestBody LoanRepayCmd cmd) {
        return Result.ok(repayService.repay(cmd));
    }
}
