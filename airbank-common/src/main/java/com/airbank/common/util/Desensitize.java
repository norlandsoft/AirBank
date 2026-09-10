package com.airbank.common.util;

public final class Desensitize {

    private Desensitize() {
    }

    /** 身份证：保留前 4 后 2 */
    public static String idNo(String id) {
        return mask(id, 4, 2);
    }

    /** 手机号：保留前 3 后 4 */
    public static String mobile(String m) {
        return mask(m, 3, 4);
    }

    /** 卡号/账号：保留前 4 后 4 */
    public static String cardNo(String c) {
        return mask(c, 4, 4);
    }

    /** 姓名：保留姓 */
    public static String name(String n) {
        if (n == null || n.isBlank()) {
            return n;
        }
        return n.charAt(0) + "*".repeat(Math.max(0, n.length() - 1));
    }

    private static String mask(String v, int head, int tail) {
        if (v == null || v.length() <= head + tail) {
            return v;
        }
        return v.substring(0, head) + "*".repeat(v.length() - head - tail) + v.substring(v.length() - tail);
    }
}
