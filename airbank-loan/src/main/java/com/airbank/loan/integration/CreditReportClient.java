package com.airbank.loan.integration;

/**
 * 征信系统外联接口（个人信用报告查询）。
 * 生产实现对接人行征信中心/百行征信前置；本工程使用 mock 实现（docs/design/13 §6）。
 */
public interface CreditReportClient {

    record CreditQueryRequest(String applyNo, String customerNo, String customerName, String idNo) { }

    /**
     * @param score            征信分（350~950）
     * @param queryCount6M     近 6 个月机构查询次数
     * @param overdueCount     历史逾期次数
     * @param currentOverdue   是否存在当前逾期
     * @param existingDebtFen  存量贷款余额（分，mock）
     */
    record CreditReport(boolean hit, int score, int queryCount6M, int overdueCount,
                        boolean currentOverdue, long existingDebtFen, String reportNo, String summary) { }

    CreditReport query(CreditQueryRequest req);
}
