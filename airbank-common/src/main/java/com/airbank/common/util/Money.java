package com.airbank.common.util;

import com.airbank.common.exception.BizException;
import com.airbank.common.exception.ErrorCodes;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.util.Locale;

/**
 * 金额工具：全行金额一律以"分"（long）存储与传输（ADR-5）。
 */
public final class Money {

    private Money() {
    }

    public static String fenToYuan(long fen) {
        return BigDecimal.valueOf(fen, 2).toPlainString();
    }

    public static String fenToYuanWithComma(long fen) {
        NumberFormat nf = NumberFormat.getNumberInstance(Locale.CHINA);
        nf.setMinimumFractionDigits(2);
        nf.setMaximumFractionDigits(2);
        return nf.format(BigDecimal.valueOf(fen, 2));
    }

    /** 元字符串 → 分；最多两位小数，必须为正 */
    public static long yuanToFen(String yuan) {
        if (yuan == null || yuan.isBlank()) {
            throw BizException.of(ErrorCodes.AMOUNT_INVALID, "金额不能为空");
        }
        try {
            BigDecimal v = new BigDecimal(yuan.trim());
            if (v.scale() > 2) {
                throw new NumberFormatException();
            }
            long fen = v.movePointRight(2).longValueExact();
            if (fen <= 0) {
                throw BizException.of(ErrorCodes.AMOUNT_INVALID, "金额必须大于 0");
            }
            return fen;
        } catch (BizException e) {
            throw e;
        } catch (Exception e) {
            throw BizException.of(ErrorCodes.AMOUNT_INVALID, "金额格式不正确（最多两位小数）");
        }
    }
}
