package com.airbank.api.core.dto;

import java.util.List;

/**
 * 总分核对报告：Σ客户账户余额 == 科目余额（docs/design/03 §7）。
 */
public record ReconReportVO(
        String batchDate,
        boolean balanced,
        long glDemandBalance,
        long detailDemandBalance,
        long glTimeBalance,
        long detailTimeBalance,
        long diff,
        List<GlBalanceVO> subjects
) {
}
