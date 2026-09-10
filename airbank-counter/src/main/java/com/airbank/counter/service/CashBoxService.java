package com.airbank.counter.service;

import com.airbank.common.exception.BizException;
import com.airbank.common.exception.ErrorCodes;
import com.airbank.counter.config.CounterParams;
import com.airbank.counter.entity.CashBox;
import com.airbank.counter.entity.CashBoxFlow;
import com.airbank.counter.mapper.CashBoxFlowMapper;
import com.airbank.counter.mapper.CashBoxMapper;
import com.airbank.counter.strategy.CashDirection;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 尾箱现金记账：取款前置余额校验（5002）、流入超限校验（5003），
 * 落账后写 t_cash_box_flow 留痕（docs/design/05 §2.1）。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CashBoxService {

    private final CashBoxMapper boxMapper;
    private final CashBoxFlowMapper flowMapper;
    private final CounterParams params;

    /** 下游调用前的前置校验（docs/design/03 §4.2：取款前尾箱余额充足） */
    public void precheck(String tellerNo, LocalDate shiftDate, CashDirection direction, long amount) {
        CashBox box = boxOf(tellerNo, shiftDate);
        if (box == null) {
            throw BizException.of(ErrorCodes.NOT_SIGNED_IN, "尾箱未初始化，请先签到");
        }
        checkLimit(box, direction, amount);
    }

    @Transactional
    public void cashIn(String tellerNo, LocalDate shiftDate, String bizType, Long ctTxnId, long amount) {
        move(tellerNo, shiftDate, bizType, ctTxnId, amount, CashDirection.IN);
    }

    @Transactional
    public void cashOut(String tellerNo, LocalDate shiftDate, String bizType, Long ctTxnId, long amount) {
        move(tellerNo, shiftDate, bizType, ctTxnId, amount, CashDirection.OUT);
    }

    /** 尾箱轧账：begin + ΣIN − ΣOUT == balance */
    @Transactional(readOnly = true)
    public Map<String, Object> reconcile(String tellerNo, LocalDate shiftDate) {
        CashBox box = boxOf(tellerNo, shiftDate);
        Map<String, Object> m = new LinkedHashMap<>();
        if (box == null) {
            m.put("exists", false);
            m.put("balanced", false);
            return m;
        }
        long flowIn = flowMapper.sumAmount(tellerNo, shiftDate, CashBoxFlow.DIR_IN);
        long flowOut = flowMapper.sumAmount(tellerNo, shiftDate, CashBoxFlow.DIR_OUT);
        boolean balanced = box.getBeginBalance() + flowIn - flowOut == box.getBalance();
        m.put("exists", true);
        m.put("balanced", balanced);
        m.put("begin", box.getBeginBalance());
        m.put("cashIn", box.getCashIn());
        m.put("cashOut", box.getCashOut());
        m.put("balance", box.getBalance());
        m.put("flowIn", flowIn);
        m.put("flowOut", flowOut);
        return m;
    }

    public CashBox boxOf(String tellerNo, LocalDate shiftDate) {
        return boxMapper.selectOne(new LambdaQueryWrapper<CashBox>()
                .eq(CashBox::getTellerNo, tellerNo)
                .eq(CashBox::getShiftDate, shiftDate));
    }

    private void move(String tellerNo, LocalDate shiftDate, String bizType, Long ctTxnId,
                      long amount, CashDirection direction) {
        if (amount <= 0) {
            return;
        }
        CashBox box = boxMapper.selectForUpdate(tellerNo, shiftDate);
        if (box == null) {
            throw BizException.of(ErrorCodes.NOT_SIGNED_IN, "尾箱未初始化，请先签到");
        }
        checkLimit(box, direction, amount);
        if (direction == CashDirection.IN) {
            box.setCashIn(box.getCashIn() + amount);
            box.setBalance(box.getBalance() + amount);
        } else {
            box.setCashOut(box.getCashOut() + amount);
            box.setBalance(box.getBalance() - amount);
        }
        boxMapper.updateById(box);

        CashBoxFlow flow = new CashBoxFlow();
        flow.setTellerNo(tellerNo);
        flow.setShiftDate(shiftDate);
        flow.setDirection(direction == CashDirection.IN ? CashBoxFlow.DIR_IN : CashBoxFlow.DIR_OUT);
        flow.setAmount(amount);
        flow.setBizType(bizType);
        flow.setCtTxnId(ctTxnId);
        flow.setBalanceAfter(box.getBalance());
        flow.setCreatedAt(LocalDateTime.now());
        flowMapper.insert(flow);
    }

    private void checkLimit(CashBox box, CashDirection direction, long amount) {
        if (direction == CashDirection.OUT && box.getBalance() < amount) {
            throw BizException.of(ErrorCodes.CASH_BOX_NOT_ENOUGH, "尾箱余额不足，请先请领现金");
        }
        if (direction == CashDirection.IN && box.getBalance() + amount > params.getCashBoxLimit()) {
            throw BizException.of(ErrorCodes.CASH_BOX_OVER_LIMIT, "尾箱超限，请先上缴现金");
        }
    }
}
