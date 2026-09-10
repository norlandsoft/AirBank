package com.airbank.counter.service;

import com.airbank.common.exception.BizException;
import com.airbank.common.exception.ErrorCodes;
import com.airbank.common.security.AuthContext;
import com.airbank.common.security.AuthUser;
import com.airbank.counter.entity.CashBox;
import com.airbank.counter.entity.DaySettlement;
import com.airbank.counter.entity.TellerShift;
import com.airbank.counter.mapper.CashBoxMapper;
import com.airbank.counter.mapper.DaySettlementMapper;
import com.airbank.counter.mapper.TellerShiftMapper;
import com.airbank.counter.model.ShiftVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 柜员工作日：签到（当日唯一班次 + 开/续尾箱）→ 受理 → 日结 → 签退（docs/design/05 §2.1）。
 */
@Service
@RequiredArgsConstructor
public class ShiftService {

    private final TellerShiftMapper shiftMapper;
    private final CashBoxMapper boxMapper;
    private final DaySettlementMapper settlementMapper;

    @Transactional
    public ShiftVO signIn() {
        AuthUser user = AuthContext.require();
        String tellerNo = requireTellerNo(user);
        String branchNo = user.branchNo() == null || user.branchNo().isBlank() ? "990" : user.branchNo();
        LocalDate today = LocalDate.now();

        TellerShift exist = byTellerAndDate(tellerNo, today);
        if (exist != null) {
            if (TellerShift.ST_CLOSED.equals(exist.getStatus())) {
                throw BizException.of(ErrorCodes.NOT_SIGNED_IN, "今日已签退，不可重复签到");
            }
            ensureBox(exist, tellerNo, today);
            return view(exist);
        }

        TellerShift shift = new TellerShift();
        shift.setTellerNo(tellerNo);
        shift.setBranchNo(branchNo);
        shift.setShiftDate(today);
        shift.setSignInAt(LocalDateTime.now());
        shift.setStatus(TellerShift.ST_OPEN);
        shiftMapper.insert(shift);
        ensureBox(shift, tellerNo, today);
        return view(shift);
    }

    /** 班次 + 尾箱视图；未签到返回 null */
    public ShiftVO today() {
        AuthUser user = AuthContext.require();
        String tellerNo = requireTellerNo(user);
        TellerShift shift = byTellerAndDate(tellerNo, LocalDate.now());
        return shift == null ? null : view(shift);
    }

    @Transactional
    public ShiftVO signOut() {
        AuthUser user = AuthContext.require();
        String tellerNo = requireTellerNo(user);
        LocalDate today = LocalDate.now();
        TellerShift shift = byTellerAndDate(tellerNo, today);
        if (shift == null) {
            throw BizException.of(ErrorCodes.NOT_SIGNED_IN, "柜员未签到");
        }
        if (TellerShift.ST_CLOSED.equals(shift.getStatus())) {
            throw BizException.of(ErrorCodes.NOT_SIGNED_IN, "今日已签退");
        }
        DaySettlement settlement = settlementMapper.selectOne(new LambdaQueryWrapper<DaySettlement>()
                .eq(DaySettlement::getTellerNo, tellerNo)
                .eq(DaySettlement::getShiftDate, today));
        if (settlement == null || !Boolean.TRUE.equals(settlement.getBalanced())) {
            throw BizException.of(ErrorCodes.DAY_SETTLE_UNBALANCED, "日结未通过或不平衡，不允许签退");
        }
        shift.setStatus(TellerShift.ST_CLOSED);
        shift.setSignOutAt(LocalDateTime.now());
        shiftMapper.updateById(shift);
        return view(shift);
    }

    /** 当前 OPEN 班次，无则 5001（受理业务前置） */
    public TellerShift requireOpenShift(String tellerNo) {
        TellerShift shift = byTellerAndDate(tellerNo, LocalDate.now());
        if (shift == null || !TellerShift.ST_OPEN.equals(shift.getStatus())) {
            throw BizException.of(ErrorCodes.NOT_SIGNED_IN, "柜员未签到或已签退");
        }
        return shift;
    }

    public String requireTellerNo() {
        return requireTellerNo(AuthContext.require());
    }

    private String requireTellerNo(AuthUser user) {
        String tellerNo = user.tellerNo();
        if (tellerNo == null || tellerNo.isBlank()) {
            throw BizException.of(ErrorCodes.NOT_SIGNED_IN, "当前登录用户无柜员号，不能进行柜面操作");
        }
        return tellerNo;
    }

    private TellerShift byTellerAndDate(String tellerNo, LocalDate date) {
        return shiftMapper.selectOne(new LambdaQueryWrapper<TellerShift>()
                .eq(TellerShift::getTellerNo, tellerNo)
                .eq(TellerShift::getShiftDate, date));
    }

    /** 开立当日尾箱；已存在则接续（上日结转 begin_balance） */
    private void ensureBox(TellerShift shift, String tellerNo, LocalDate today) {
        CashBox box = boxMapper.selectOne(new LambdaQueryWrapper<CashBox>()
                .eq(CashBox::getTellerNo, tellerNo)
                .eq(CashBox::getShiftDate, today));
        if (box != null) {
            return;
        }
        CashBox last = boxMapper.selectOne(new LambdaQueryWrapper<CashBox>()
                .eq(CashBox::getTellerNo, tellerNo)
                .lt(CashBox::getShiftDate, today)
                .orderByDesc(CashBox::getShiftDate)
                .last("LIMIT 1"));
        long begin = last == null || last.getBalance() == null ? 0L : last.getBalance();
        CashBox created = new CashBox();
        created.setTellerNo(tellerNo);
        created.setShiftDate(today);
        created.setBeginBalance(begin);
        created.setCashIn(0L);
        created.setCashOut(0L);
        created.setBalance(begin);
        boxMapper.insert(created);
    }

    public ShiftVO view(TellerShift shift) {
        CashBox box = boxMapper.selectOne(new LambdaQueryWrapper<CashBox>()
                .eq(CashBox::getTellerNo, shift.getTellerNo())
                .eq(CashBox::getShiftDate, shift.getShiftDate()));
        DaySettlement settlement = settlementMapper.selectOne(new LambdaQueryWrapper<DaySettlement>()
                .eq(DaySettlement::getTellerNo, shift.getTellerNo())
                .eq(DaySettlement::getShiftDate, shift.getShiftDate()));
        return new ShiftVO(
                shift.getId(), shift.getTellerNo(), shift.getBranchNo(), shift.getShiftDate(),
                shift.getStatus(), shift.getSignInAt(), shift.getSignOutAt(),
                box == null ? 0L : box.getBeginBalance(),
                box == null ? 0L : box.getCashIn(),
                box == null ? 0L : box.getCashOut(),
                box == null ? 0L : box.getBalance(),
                settlement != null,
                settlement == null ? null : settlement.getBalanced());
    }
}
