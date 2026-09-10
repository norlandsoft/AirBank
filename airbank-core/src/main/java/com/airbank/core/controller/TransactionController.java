package com.airbank.core.controller;

import com.airbank.api.core.dto.TimeDepositCmd;
import com.airbank.api.core.dto.TimeDepositVO;
import com.airbank.api.core.dto.TxnCmd;
import com.airbank.api.core.dto.TxnQuery;
import com.airbank.api.core.dto.TxnVO;
import com.airbank.common.api.PageResult;
import com.airbank.common.api.Result;
import com.airbank.core.service.TimeDepositService;
import com.airbank.core.service.TransactionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class TransactionController {

    private final TransactionService transactionService;
    private final TimeDepositService timeDepositService;

    /** 统一记账（幂等，docs/design/03 §2.2） */
    @PostMapping("/txns")
    public Result<TxnVO> post(@RequestHeader(value = "X-Batch-Date", required = false) String batchDate,
                              @Valid @RequestBody TxnCmd cmd) {
        return Result.ok(transactionService.post(cmd, batchDate));
    }

    @GetMapping("/txns/{txnNo}")
    public Result<TxnVO> get(@PathVariable String txnNo) {
        return Result.ok(transactionService.byTxnNo(txnNo));
    }

    @GetMapping("/txns")
    public Result<PageResult<TxnVO>> page(@Valid TxnQuery query) {
        return Result.ok(transactionService.page(query));
    }

    @PostMapping("/txns/{txnNo}/reverse")
    public Result<TxnVO> reverse(@PathVariable String txnNo, @RequestParam String requestNo,
                                 @RequestParam String operator,
                                 @RequestParam(required = false, defaultValue = "990") String branchNo) {
        return Result.ok(transactionService.reverseByCounter(txnNo, requestNo, operator, branchNo));
    }

    @PostMapping("/time-deposits")
    public Result<TimeDepositVO> createTimeDeposit(
            @RequestHeader(value = "X-Batch-Date", required = false) String batchDate,
            @Valid @RequestBody TimeDepositCmd cmd) {
        return Result.ok(timeDepositService.create(cmd,
                batchDate == null ? java.time.LocalDate.now() : java.time.LocalDate.parse(batchDate)));
    }

    @PostMapping("/time-deposits/{depositNo}/break")
    public Result<TxnVO> breakDeposit(@PathVariable String depositNo,
                                      @RequestParam String requestNo, @RequestParam String operator) {
        List<TxnVO> txns = timeDepositService.breakDeposit(depositNo, requestNo, operator, java.time.LocalDate.now());
        // 本金+利息拆单入账；对外返回本金交易（利息流水可按 requestNo 前缀查询）
        return Result.ok(txns.isEmpty() ? null : txns.get(0));
    }

    @GetMapping("/time-deposits")
    public Result<List<TimeDepositVO>> timeDeposits(@RequestParam(required = false) Long customerId,
                                                    @RequestParam(required = false) String acctNo) {
        return Result.ok(timeDepositService.list(customerId, acctNo));
    }
}
