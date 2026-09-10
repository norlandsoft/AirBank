package com.airbank.counter.controller;

import com.airbank.common.api.PageResult;
import com.airbank.common.api.Result;
import com.airbank.counter.model.CtVO;
import com.airbank.counter.model.TxnAcceptCmd;
import com.airbank.counter.service.CounterTxnService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 统一受理（docs/design/05 §2.2）：POST /txns、列表、当日失败重发。
 */
@RestController
@RequestMapping("/txns")
@RequiredArgsConstructor
public class TxnController {

    private final CounterTxnService counterTxnService;

    @PostMapping
    public Result<CtVO> accept(@RequestBody TxnAcceptCmd cmd) {
        return Result.ok(counterTxnService.accept(cmd));
    }

    @GetMapping
    public Result<PageResult<CtVO>> page(@RequestParam(required = false) String status,
                                         @RequestParam(defaultValue = "false") boolean mine,
                                         @RequestParam(defaultValue = "1") int pageNum,
                                         @RequestParam(defaultValue = "20") int pageSize) {
        return Result.ok(counterTxnService.page(status, mine, pageNum, pageSize));
    }

    @PostMapping("/{id}/retry")
    public Result<CtVO> retry(@PathVariable Long id) {
        return Result.ok(counterTxnService.retry(id));
    }
}
