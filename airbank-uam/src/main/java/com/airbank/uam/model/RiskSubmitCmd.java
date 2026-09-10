package com.airbank.uam.model;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record RiskSubmitCmd(
        @NotNull Long customerId,
        @Size(min = 5, max = 5, message = "问卷须为 5 题") List<Integer> scores
) {
}
