package com.airbank.counter.service;

import com.airbank.common.api.PageResult;
import com.airbank.common.exception.BizException;
import com.airbank.common.exception.ErrorCodes;
import com.airbank.common.security.AuthContext;
import com.airbank.common.security.AuthUser;
import com.airbank.counter.entity.CounterTxn;
import com.airbank.counter.entity.ReviewLog;
import com.airbank.counter.mapper.CounterTxnMapper;
import com.airbank.counter.mapper.ReviewLogMapper;
import com.airbank.counter.model.CtVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 主管复核授权（docs/design/05 §2.2）：队列查看 → 通过（系统自动执行，防"先斩后奏"）/ 驳回；
 * 权限由 @RequirePerm("review:authorize") 控制，自复核禁止（5006），操作写独立审计。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ReviewService {

    private final CounterTxnMapper txnMapper;
    private final ReviewLogMapper reviewLogMapper;
    private final CounterTxnService counterTxnService;

    public PageResult<CtVO> pending(int pageNum, int pageSize) {
        Page<CounterTxn> page = txnMapper.selectPage(new Page<>(pageNum, pageSize),
                new LambdaQueryWrapper<CounterTxn>()
                        .eq(CounterTxn::getStatus, CounterTxn.ST_PENDING_REVIEW)
                        .orderByAsc(CounterTxn::getId));
        List<CtVO> list = page.getRecords().stream().map(CtVO::of).toList();
        return new PageResult<>(list, page.getTotal(), pageNum, pageSize);
    }

    @Transactional
    public CtVO approve(Long id, String comment) {
        AuthUser user = AuthContext.require();
        CounterTxn txn = requireTxn(id);
        if (!CounterTxn.ST_PENDING_REVIEW.equals(txn.getStatus())) {
            throw BizException.of(ErrorCodes.CT_STATUS_DENY, "该单据当前状态不允许复核");
        }
        String reviewerNo = reviewerOf(user);
        if (reviewerNo.equals(txn.getTellerNo())) {
            throw BizException.of(ErrorCodes.SELF_REVIEW_DENY, "自复核禁止：受理人与复核人不能相同");
        }
        txn.setReviewerNo(reviewerNo);
        txn.setReviewedAt(LocalDateTime.now());
        txn.setReviewComment(comment == null || comment.isBlank() ? "同意" : comment);
        txn.setStatus(CounterTxn.ST_EXECUTING);
        txnMapper.updateById(txn);
        writeLog(txn.getId(), ReviewLog.ACTION_APPROVE, reviewerNo, txn.getReviewComment());
        // 系统自动执行，申请单不回柜员手中重放
        return counterTxnService.executeAndFinish(txn);
    }

    @Transactional
    public CtVO reject(Long id, String comment) {
        AuthUser user = AuthContext.require();
        CounterTxn txn = requireTxn(id);
        if (!CounterTxn.ST_PENDING_REVIEW.equals(txn.getStatus())) {
            throw BizException.of(ErrorCodes.CT_STATUS_DENY, "该单据当前状态不允许复核");
        }
        String reviewerNo = reviewerOf(user);
        if (comment == null || comment.isBlank()) {
            comment = "驳回";
        }
        txn.setReviewerNo(reviewerNo);
        txn.setReviewedAt(LocalDateTime.now());
        txn.setReviewComment(comment);
        txn.setStatus(CounterTxn.ST_REJECTED);
        txnMapper.updateById(txn);
        writeLog(txn.getId(), ReviewLog.ACTION_REJECT, reviewerNo, comment);
        return CtVO.of(txn);
    }

    private CounterTxn requireTxn(Long id) {
        CounterTxn txn = txnMapper.selectById(id);
        if (txn == null) {
            throw BizException.of(ErrorCodes.NOT_FOUND, "申请单不存在");
        }
        return txn;
    }

    private String reviewerOf(AuthUser user) {
        if (user.tellerNo() != null && !user.tellerNo().isBlank()) {
            return user.tellerNo();
        }
        return user.loginName();
    }

    private void writeLog(Long ctTxnId, String action, String actor, String comment) {
        ReviewLog log1 = new ReviewLog();
        log1.setCtTxnId(ctTxnId);
        log1.setAction(action);
        log1.setActor(actor);
        log1.setComment(comment == null || comment.length() <= 200 ? comment : comment.substring(0, 200));
        log1.setCreatedAt(LocalDateTime.now());
        reviewLogMapper.insert(log1);
    }
}
