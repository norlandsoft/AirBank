package com.airbank.api.loan;

import com.airbank.api.loan.dto.LoanApplicationVO;
import com.airbank.api.loan.dto.LoanApplyCmd;
import com.airbank.api.loan.dto.LoanDetailVO;
import com.airbank.api.loan.dto.LoanAccountVO;
import com.airbank.api.loan.dto.LoanProductVO;
import com.airbank.api.loan.dto.LoanRepayCmd;
import com.airbank.api.loan.dto.LoanRepaymentVO;
import com.airbank.common.api.Result;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.List;

/**
 * 小额信贷系统服务间契约（docs/design/13 §4）。幂等键 requestNo 全链路传递。
 */
@FeignClient(name = "airbank-loan", contextId = "loanClient", path = "/api/loan")
public interface LoanClient {

    @GetMapping("/products")
    Result<List<LoanProductVO>> listProducts(@RequestParam(value = "status", required = false) String status);

    @GetMapping("/products/{code}")
    Result<LoanProductVO> getProduct(@PathVariable("code") String code);

    /** 贷款申请：受理后同步完成 联网核查 → 征信查询 → 自动审批 →（通过则）放款 */
    @PostMapping("/applications")
    Result<LoanApplicationVO> apply(@RequestBody LoanApplyCmd cmd);

    @GetMapping("/applications")
    Result<List<LoanApplicationVO>> applications(@RequestParam("customerId") Long customerId);

    @GetMapping("/applications/{applyNo}")
    Result<LoanApplicationVO> getApplication(@PathVariable("applyNo") String applyNo);

    @GetMapping("/loans")
    Result<List<LoanAccountVO>> loans(@RequestParam("customerId") Long customerId);

    /** 借据详情：台账 + 还款计划 + 还款记录 */
    @GetMapping("/loans/{loanNo}")
    Result<LoanDetailVO> loanDetail(@PathVariable("loanNo") String loanNo);

    /** 还款：INSTALLMENT 还最早未还一期；SETTLE 提前结清（剩余本金 + 当期利息） */
    @PostMapping("/loans/repay")
    Result<LoanRepaymentVO> repay(@RequestBody LoanRepayCmd cmd);
}
