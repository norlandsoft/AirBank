package com.airbank.ebank.controller;

import com.airbank.api.loan.dto.LoanAccountVO;
import com.airbank.api.loan.dto.LoanApplicationVO;
import com.airbank.api.loan.dto.LoanDetailVO;
import com.airbank.api.loan.dto.LoanProductVO;
import com.airbank.api.loan.dto.LoanRepaymentVO;
import com.airbank.common.api.Result;
import com.airbank.ebank.model.LoanApplyReq;
import com.airbank.ebank.model.LoanRepayReq;
import com.airbank.ebank.service.LoanFacade;
import com.airbank.ebank.service.OwnerGuard;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 小额信贷（docs/design/13 §7，渠道编排，均限本人）。
 */
@RestController
@RequiredArgsConstructor
public class LoanController {

    private final LoanFacade loanFacade;

    @GetMapping("/loan/products")
    public Result<List<LoanProductVO>> products() {
        OwnerGuard.requireCustomerId();
        return Result.ok(loanFacade.products());
    }

    @PostMapping("/loan/apply")
    public Result<LoanApplicationVO> apply(@Valid @RequestBody LoanApplyReq req) {
        return Result.ok(loanFacade.apply(OwnerGuard.requireCustomerId(), req));
    }

    @GetMapping("/loan/applications")
    public Result<List<LoanApplicationVO>> applications() {
        return Result.ok(loanFacade.applications(OwnerGuard.requireCustomerId()));
    }

    @GetMapping("/loan/loans")
    public Result<List<LoanAccountVO>> loans() {
        return Result.ok(loanFacade.loans(OwnerGuard.requireCustomerId()));
    }

    @GetMapping("/loan/loans/{loanNo}")
    public Result<LoanDetailVO> loanDetail(@PathVariable("loanNo") String loanNo) {
        return Result.ok(loanFacade.loanDetail(OwnerGuard.requireCustomerId(), loanNo));
    }

    @PostMapping("/loan/repay")
    public Result<LoanRepaymentVO> repay(@Valid @RequestBody LoanRepayReq req) {
        return Result.ok(loanFacade.repay(OwnerGuard.requireCustomerId(), req));
    }
}
