package com.airbank.common.util;

import com.airbank.common.exception.BizException;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MoneyTest {

    @Test
    void fenToYuan() {
        assertThat(Money.fenToYuan(123456)).isEqualTo("1234.56");
        assertThat(Money.fenToYuan(5)).isEqualTo("0.05");
        assertThat(Money.fenToYuan(0)).isEqualTo("0.00");
    }

    @Test
    void yuanToFen() {
        assertThat(Money.yuanToFen("1234.56")).isEqualTo(123456L);
        assertThat(Money.yuanToFen("12")).isEqualTo(1200L);
        assertThat(Money.yuanToFen("0.5")).isEqualTo(50L);
    }

    @Test
    void invalidAmountShouldBeRejected() {
        assertThatThrownBy(() -> Money.yuanToFen("1.234")).isInstanceOf(BizException.class);
        assertThatThrownBy(() -> Money.yuanToFen("0")).isInstanceOf(BizException.class);
        assertThatThrownBy(() -> Money.yuanToFen("-5")).isInstanceOf(BizException.class);
        assertThatThrownBy(() -> Money.yuanToFen("abc")).isInstanceOf(BizException.class);
    }
}
