package com.airbank.counter.service;

import com.airbank.counter.entity.CashBox;
import com.airbank.counter.model.DashboardVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;

/**
 * 工作台看板（docs/design/05 §2.3）：今日业务统计、尾箱余额、待复核数。
 */
@Service
@RequiredArgsConstructor
public class DashboardService {

    private final CounterTxnService counterTxnService;
    private final CashBoxService cashBoxService;
    private final ShiftService shiftService;

    public DashboardVO dashboard() {
        String tellerNo = shiftService.requireTellerNo();
        LocalDate today = LocalDate.now();
        long todayCount = counterTxnService.countPosted(tellerNo, today);
        long todayAmount = counterTxnService.sumPostedAmount(tellerNo, today);
        CashBox box = cashBoxService.boxOf(tellerNo, today);
        long pendingReviews = counterTxnService.countPendingReview();
        return new DashboardVO(
                todayCount,
                todayAmount,
                box == null ? 0L : box.getCashIn(),
                box == null ? 0L : box.getCashOut(),
                box == null ? 0L : box.getBalance(),
                pendingReviews);
    }
}
