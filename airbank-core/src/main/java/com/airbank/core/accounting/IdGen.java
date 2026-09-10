package com.airbank.core.accounting;

import com.airbank.common.util.Luhn;

/**
 * 编号生成（docs/design/03 §3）。序号来自数据库序列，校验位 Luhn。
 */
public final class IdGen {

    public static final String PRODUCT_DEMAND = "0001";
    public static final String PRODUCT_TIME = "0002";

    private IdGen() {
    }

    /** 18 位账号：3 位机构 + 4 位产品码 + 10 位序号 + Luhn 校验位 */
    public static String acctNo(String branchNo, String productCode, long seq) {
        String body = branchNo + productCode + String.format("%010d", seq);
        return Luhn.appendCheckDigit(body);
    }

    /** 19 位卡号：62 + 16 位序号 + Luhn 校验位 */
    public static String cardNo(long seq) {
        String body = "62" + String.format("%016d", seq);
        return Luhn.appendCheckDigit(body);
    }

    /** 核心流水号：TX + yyyyMMddHHmmss + 6 位序列 + 3 位随机 */
    public static String txnNo(String yyyyMMddHHmmss, long seq, String random3) {
        return "TX" + yyyyMMddHHmmss + String.format("%06d", seq % 1_000_000) + random3;
    }

    /** 定期存单号：TD + yyyyMMdd + 8 位序列 */
    public static String depositNo(String yyyyMMdd, long seq) {
        return "TD" + yyyyMMdd + String.format("%08d", seq % 100_000_000);
    }
}
