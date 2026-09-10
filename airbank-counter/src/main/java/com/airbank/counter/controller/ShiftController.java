package com.airbank.counter.controller;

import com.airbank.common.api.Result;
import com.airbank.counter.model.ShiftVO;
import com.airbank.counter.service.ShiftService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 签到 / 班次 / 签退（docs/design/05 §2.1）。
 */
@RestController
@RequestMapping("/shift")
@RequiredArgsConstructor
public class ShiftController {

    private final ShiftService shiftService;

    @PostMapping("/sign-in")
    public Result<ShiftVO> signIn() {
        return Result.ok(shiftService.signIn());
    }

    @GetMapping("/today")
    public Result<ShiftVO> today() {
        return Result.ok(shiftService.today());
    }

    @PostMapping("/sign-out")
    public Result<ShiftVO> signOut() {
        return Result.ok(shiftService.signOut());
    }
}
