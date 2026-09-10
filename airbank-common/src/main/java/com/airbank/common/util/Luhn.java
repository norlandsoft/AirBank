package com.airbank.common.util;

/**
 * Luhn 校验位（账号/卡号，docs/design/03 §3）：编号 = 主体数字 + 1 位校验位，使整串通过 Luhn 校验。
 */
public final class Luhn {

    private Luhn() {
    }

    /** 为主体数字追加 Luhn 校验位，返回完整编号 */
    public static String appendCheckDigit(String body) {
        return body + checkDigit(body);
    }

    /** 计算校验位（使 body + digit 整体通过 Luhn） */
    public static int checkDigit(String body) {
        int sum = 0;
        boolean dbl = true; // 从右起：校验位位置不翻倍，主体最右位翻倍
        for (int i = body.length() - 1; i >= 0; i--) {
            int d = body.charAt(i) - '0';
            if (dbl) {
                d *= 2;
                if (d > 9) {
                    d -= 9;
                }
            }
            sum += d;
            dbl = !dbl;
        }
        return (10 - sum % 10) % 10;
    }

    public static boolean valid(String number) {
        if (number == null || number.length() < 2 || !number.chars().allMatch(Character::isDigit)) {
            return false;
        }
        int sum = 0;
        boolean dbl = false;
        for (int i = number.length() - 1; i >= 0; i--) {
            int d = number.charAt(i) - '0';
            if (dbl) {
                d *= 2;
                if (d > 9) {
                    d -= 9;
                }
            }
            sum += d;
            dbl = !dbl;
        }
        return sum % 10 == 0;
    }
}
