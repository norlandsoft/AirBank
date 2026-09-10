package com.airbank.common.util;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class LuhnTest {

    @Test
    void appendCheckDigitShouldPassValidation() {
        String acct = Luhn.appendCheckDigit("99000011000000000");
        assertThat(acct).hasSize(18);
        assertThat(Luhn.valid(acct)).isTrue();
    }

    @Test
    void knownCardBodyShouldValidate() {
        assertThat(Luhn.valid(Luhn.appendCheckDigit("620000000000123456"))).isTrue();
    }

    @Test
    void invalidNumberShouldFail() {
        assertThat(Luhn.valid("1234567890123456")).isFalse();
        assertThat(Luhn.valid(null)).isFalse();
        assertThat(Luhn.valid("12ab")).isFalse();
    }
}
