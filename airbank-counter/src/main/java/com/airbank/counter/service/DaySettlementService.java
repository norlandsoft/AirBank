package com.airbank.counter.service;

import com.airbank.common.exception.BizException;
import com.airbank.common.exception.ErrorCodes;
import com.airbank.counter.entity.CashBoxFlow;
import com.airbank.counter.entity.CounterTxn;
import com.airbank.counter.entity.DaySettlement;
import com.airbank.counter.mapper.CashBoxFlowMapper;
import com.airbank.counter.mapper.DaySettlementMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 柜员日结（docs/design/05 §2.1）：汇总当日 POSTED 申请单（笔数/借贷/现金收付），
 * 核对尾箱 begin + ΣIN − ΣOUT == balance → 落 t_day_settlement（unique(teller, shift_date) 幂等）。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DaySettlementService {

    private static final DateTimeFormatter TS = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final DaySettlementMapper settlementMapper;
    private final CounterTxnService counterTxnService;
    private final CashBoxService cashBoxService;
    private final CashBoxFlowMapper flowMapper;
    private final ShiftService shiftService;

    @Transactional
    public DaySettlement create() {
        String tellerNo = shiftService.requireTellerNo();
        LocalDate today = LocalDate.now();

        // 幂等：unique(teller_no, shift_date)
        DaySettlement exist = byTellerAndDate(tellerNo, today);
        if (exist != null) {
            return exist;
        }
        // 日结在营业中发起，须已签到
        shiftService.requireOpenShift(tellerNo);

        List<CounterTxn> posted = counterTxnService.listPosted(tellerNo, today);
        long cashIn = 0;
        long cashOut = 0;
        long debitTotal = 0;
        long creditTotal = 0;
        Map<String, Object> byBizType = new LinkedHashMap<>();
        for (CounterTxn t : posted) {
            long amount = t.getAmount() == null ? 0L : t.getAmount();
            if (counterTxnService.isCashIn(t.getBizType())) {
                cashIn += amount;
            }
            if (counterTxnService.isCashOut(t.getBizType())) {
                cashOut += amount;
            }
            if (counterTxnService.isDebit(t.getBizType())) {
                debitTotal += amount;
            }
            if (counterTxnService.isCredit(t.getBizType())) {
                creditTotal += amount;
            }
            @SuppressWarnings("unchecked")
            Map<String, Object> stat = (Map<String, Object>) byBizType
                    .computeIfAbsent(t.getBizType(), k -> {
                        Map<String, Object> m = new LinkedHashMap<>();
                        m.put("count", 0);
                        m.put("amount", 0L);
                        return m;
                    });
            stat.put("count", (int) stat.get("count") + 1);
            stat.put("amount", (long) stat.get("amount") + amount);
        }

        Map<String, Object> boxView = cashBoxService.reconcile(tellerNo, today);
        boolean balanced = Boolean.TRUE.equals(boxView.get("balanced"));
        long flowIn = flowMapper.sumAmount(tellerNo, today, CashBoxFlow.DIR_IN);
        long flowOut = flowMapper.sumAmount(tellerNo, today, CashBoxFlow.DIR_OUT);

        Map<String, Object> report = new LinkedHashMap<>();
        report.put("bizDate", today.toString());
        report.put("settledAt", LocalDateTime.now().format(TS));
        report.put("txnCount", posted.size());
        report.put("cashIn", cashIn);
        report.put("cashOut", cashOut);
        report.put("debitTotal", debitTotal);
        report.put("creditTotal", creditTotal);
        report.put("byBizType", byBizType);
        report.put("box", boxView);
        report.put("flowIn", flowIn);
        report.put("flowOut", flowOut);
        report.put("balanced", balanced);
        report.put("mark", "AirBank 培训环境专用");

        DaySettlement settlement = new DaySettlement();
        settlement.setTellerNo(tellerNo);
        settlement.setShiftDate(today);
        settlement.setTxnCount(posted.size());
        settlement.setCashIn(cashIn);
        settlement.setCashOut(cashOut);
        settlement.setDebitTotal(debitTotal);
        settlement.setCreditTotal(creditTotal);
        settlement.setBoxBegin(boxLong(boxView, "begin"));
        settlement.setBoxEnd(boxLong(boxView, "balance"));
        settlement.setBalanced(balanced);
        settlement.setReport(report);
        settlementMapper.insert(settlement);
        log.info("day settlement created: teller={} date={} count={} balanced={}",
                tellerNo, today, posted.size(), balanced);
        return settlement;
    }

    public DaySettlement today() {
        return byTellerAndDate(shiftService.requireTellerNo(), LocalDate.now());
    }

    private DaySettlement byTellerAndDate(String tellerNo, LocalDate date) {
        return settlementMapper.selectOne(new LambdaQueryWrapper<DaySettlement>()
                .eq(DaySettlement::getTellerNo, tellerNo)
                .eq(DaySettlement::getShiftDate, date));
    }

    private long boxLong(Map<String, Object> boxView, String key) {
        Object v = boxView.get(key);
        return v instanceof Number n ? n.longValue() : 0L;
    }
}
