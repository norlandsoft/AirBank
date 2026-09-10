package com.airbank.ebank.controller;

import com.airbank.common.api.PageResult;
import com.airbank.common.api.Result;
import com.airbank.ebank.entity.Message;
import com.airbank.ebank.service.MessageService;
import com.airbank.ebank.service.OwnerGuard;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 消息中心（仅本人）。
 */
@RestController
@RequestMapping("/messages")
@RequiredArgsConstructor
public class MessageController {

    private final MessageService messageService;

    @GetMapping
    public Result<PageResult<Message>> list(@RequestParam(defaultValue = "1") int pageNum,
                                            @RequestParam(defaultValue = "20") int pageSize,
                                            @RequestParam(defaultValue = "false") boolean unreadOnly) {
        return Result.ok(messageService.page(OwnerGuard.requireCustomerId(), unreadOnly, pageNum, pageSize));
    }

    @PutMapping("/{id}/read")
    public Result<Boolean> read(@PathVariable Long id) {
        messageService.markRead(OwnerGuard.requireCustomerId(), id);
        return Result.ok(true);
    }
}
