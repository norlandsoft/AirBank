package com.airbank.loan.integration;

/**
 * 联网核查系统外联接口（公民身份信息核查）。
 * 生产实现对接公安一所/央行联网核查前置；本工程使用 mock 实现（docs/design/13 §6）。
 */
public interface IdentityCheckClient {

    record IdCheckRequest(String applyNo, String customerName, String idNo) { }

    record IdCheckResult(boolean pass, String result, String detail) { }

    /** 核查姓名与证件号一致性；结果需落 t_ext_check_log 留痕 */
    IdCheckResult verify(IdCheckRequest req);
}
