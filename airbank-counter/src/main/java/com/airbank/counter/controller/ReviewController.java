package com.airbank.counter.controller;

import com.airbank.common.api.PageResult;
import com.airbank.common.api.Result;
import com.airbank.common.security.RequirePerm;
import com.airbank.counter.model.CtVO;
import com.airbank.counter.model.ReviewRequest;
import com.airbank.counter.service.ReviewService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 待复核授权（主管，docs/design/05 §2.2）。
 */
@RestController
@RequestMapping("/review")
@RequiredArgsConstructor
public class ReviewController {

    private final ReviewService reviewService;

    @RequirePerm("review:authorize")
    @GetMapping("/pending")
    public Result<PageResult<CtVO>> pending(@RequestParam(defaultValue = "1") int pageNum,
                                            @RequestParam(defaultValue = "20") int pageSize) {
        return Result.ok(reviewService.pending(pageNum, pageSize));
    }

    @RequirePerm("review:authorize")
    @PostMapping("/{id}/approve")
    public Result<CtVO> approve(@PathVariable Long id,
                                @RequestBody(required = false) ReviewRequest req) {
        return Result.ok(reviewService.approve(id, req == null ? null : req.comment()));
    }

    @RequirePerm("review:authorize")
    @PostMapping("/{id}/reject")
    public Result<CtVO> reject(@PathVariable Long id,
                               @RequestBody(required = false) ReviewRequest req) {
        return Result.ok(reviewService.reject(id, req == null ? null : req.comment()));
    }
}
