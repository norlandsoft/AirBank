package com.airbank.loan.integration;

import com.airbank.loan.entity.ExtCheckLog;
import com.airbank.loan.mapper.ExtCheckLogMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * 征信查询 mock 实现（docs/design/13 §6.2）。
 * 规则（对同一客户确定性，可重复演示）：
 *  - 以 customerNo+idNo 哈希生成征信分 560~920、查询次数、逾期次数、存量负债；
 *  - 培训触发词：姓名含 "逾期" → 征信分 480 + 当前逾期（演示征信拒绝链路）；
 *  - 姓名含 "白户" → 无征信记录（hit=false，演示白户拒绝链路）。
 */
@Slf4j
@Primary
@Component
@RequiredArgsConstructor
public class MockCreditReportClient implements CreditReportClient {

    private final ExtCheckLogMapper logMapper;

    @Override
    public CreditReport query(CreditQueryRequest req) {
        String name = req.customerName() == null ? "" : req.customerName();
        boolean blank = name.contains("白户");
        boolean overdueDemo = name.contains("逾期");
        int seed = Math.floorMod((req.customerNo() + "|" + req.idNo()).hashCode(), 10_000);

        CreditReport report;
        String reportNo = "MCR" + LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE)
                + String.format("%06d", seed);
        if (blank) {
            report = new CreditReport(false, 0, 0, 0, false, 0L, reportNo, "未查询到信贷记录（mock 白户）");
        } else if (overdueDemo) {
            report = new CreditReport(true, 480, 9, 5, true, 800_000L, reportNo,
                    "存在当前逾期，近6个月查询 9 次（mock 高风险画像）");
        } else {
            int score = 560 + seed % 361;          // 560~920
            int queryCount = seed % 4;              // 0~3 次
            int overdueCount = seed % 11 == 0 ? 1 : 0; // 偶发历史逾期（已结清）
            long debt = (seed % 50) * 10_000L;      // 0~49万 存量负债（分刻度：×100）
            report = new CreditReport(true, score, queryCount, overdueCount, false, debt * 100, reportNo,
                    "信用记录良好（mock 画像）");
        }
        ExtCheckLog row = new ExtCheckLog();
        row.setBizNo(req.applyNo());
        row.setCheckType(ExtCheckLog.TYPE_CREDIT_REPORT);
        row.setRequestText("customerNo=" + req.customerNo() + ", name=" + req.customerName());
        row.setResponseText("{\"reportNo\":\"" + report.reportNo() + "\",\"hit\":" + report.hit()
                + ",\"score\":" + report.score() + ",\"queryCount6M\":" + report.queryCount6M()
                + ",\"overdueCount\":" + report.overdueCount() + ",\"currentOverdue\":" + report.currentOverdue()
                + ",\"existingDebtFen\":" + report.existingDebtFen() + "}");
        row.setResult(report.hit() ? "HIT" : "CLEAR");
        row.setCreatedAt(LocalDateTime.now());
        logMapper.insert(row);
        log.info("[ext-mock] credit-report {} -> hit={}, score={}", req.applyNo(), report.hit(), report.score());
        return report;
    }
}
