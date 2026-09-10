package com.airbank.api.core;

import com.airbank.api.core.dto.AccountStatusCmd;
import com.airbank.api.core.dto.AccountVO;
import com.airbank.api.core.dto.BatchVO;
import com.airbank.api.core.dto.GlBalanceVO;
import com.airbank.api.core.dto.OpenAccountCmd;
import com.airbank.api.core.dto.ReconReportVO;
import com.airbank.api.core.dto.TimeDepositCmd;
import com.airbank.api.core.dto.TimeDepositVO;
import com.airbank.api.core.dto.TxnCmd;
import com.airbank.api.core.dto.TxnQuery;
import com.airbank.api.core.dto.TxnVO;
import com.airbank.common.api.PageResult;
import com.airbank.common.api.Result;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.cloud.openfeign.SpringQueryMap;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.List;

/**
 * 核心系统服务间契约。幂等键 requestNo 全链路传递。
 * batchDate 参数用于日终批量场景（服务间调用无会计日期上下文，显式传入）。
 */
@FeignClient(name = "airbank-core", contextId = "coreClient", path = "/api/core")
public interface CoreClient {

    @PostMapping("/accounts")
    Result<AccountVO> openAccount(@RequestBody OpenAccountCmd cmd);

    @GetMapping("/accounts/{acctNo}")
    Result<AccountVO> getAccount(@PathVariable("acctNo") String acctNo);

    @GetMapping("/accounts")
    Result<List<AccountVO>> listAccounts(@RequestParam("customerId") Long customerId);

    @PostMapping("/accounts/{acctNo}/status")
    Result<AccountVO> changeAccountStatus(@PathVariable("acctNo") String acctNo,
                                          @RequestHeader(value = "X-Batch-Date", required = false) String batchDate,
                                          @RequestBody AccountStatusCmd cmd);

    @PostMapping("/txns")
    Result<TxnVO> postTxn(@RequestHeader(value = "X-Batch-Date", required = false) String batchDate,
                          @RequestBody TxnCmd cmd);

    @GetMapping("/txns/{txnNo}")
    Result<TxnVO> getTxn(@PathVariable("txnNo") String txnNo);

    @PostMapping("/txns/{txnNo}/reverse")
    Result<TxnVO> reverseTxn(@PathVariable("txnNo") String txnNo,
                             @RequestParam("requestNo") String requestNo,
                             @RequestParam("operator") String operator,
                             @RequestParam("branchNo") String branchNo);

    @GetMapping("/txns")
    Result<PageResult<TxnVO>> pageTxns(@SpringQueryMap TxnQuery query);

    @PostMapping("/time-deposits")
    Result<TimeDepositVO> createTimeDeposit(@RequestHeader(value = "X-Batch-Date", required = false) String batchDate,
                                            @RequestBody TimeDepositCmd cmd);

    @PostMapping("/time-deposits/{depositNo}/break")
    Result<TxnVO> breakTimeDeposit(@PathVariable("depositNo") String depositNo,
                                   @RequestParam("requestNo") String requestNo,
                                   @RequestParam("operator") String operator);

    @GetMapping("/time-deposits")
    Result<List<TimeDepositVO>> listTimeDeposits(@RequestParam(value = "customerId", required = false) Long customerId,
                                                 @RequestParam(value = "acctNo", required = false) String acctNo);

    @GetMapping("/internal/gl/balances")
    Result<List<GlBalanceVO>> glBalances(@RequestParam("batchDate") String batchDate);

    @GetMapping("/batch/recon-report")
    Result<ReconReportVO> reconReport(@RequestParam("batchDate") String batchDate);

    @PostMapping("/internal/batch/day-end/trigger")
    Result<BatchVO> triggerDayEnd(@RequestParam(value = "batchDate", required = false) String batchDate);

    @GetMapping("/internal/batch/tasks/{id}")
    Result<BatchVO> batchTask(@PathVariable("id") Long id);
}
