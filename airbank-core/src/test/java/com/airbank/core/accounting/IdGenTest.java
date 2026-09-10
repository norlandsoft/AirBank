package com.airbank.core.accounting;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class IdGenTest {

    @Test
    void acctNoShouldBe18DigitsAndLuhnValid() {
        String acct = IdGen.acctNo("990", IdGen.PRODUCT_DEMAND, 42);
        assertThat(acct).hasSize(18).startsWith("9900001");
        assertThat(com.airbank.common.util.Luhn.valid(acct)).isTrue();
    }

    @Test
    void cardNoShouldBe19DigitsStartingWith62() {
        String card = IdGen.cardNo(1001);
        assertThat(card).hasSize(19).startsWith("62");
        assertThat(com.airbank.common.util.Luhn.valid(card)).isTrue();
    }

    @Test
    void depositNoShouldHaveDateAndSeq() {
        assertThat(IdGen.depositNo("20260910", 7)).isEqualTo("TD2026091000000007");
    }
}
