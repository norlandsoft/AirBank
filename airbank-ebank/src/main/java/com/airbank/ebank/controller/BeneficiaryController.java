package com.airbank.ebank.controller;

import com.airbank.common.api.Result;
import com.airbank.ebank.entity.Beneficiary;
import com.airbank.ebank.model.BeneficiaryCmd;
import com.airbank.ebank.service.BeneficiaryService;
import com.airbank.ebank.service.OwnerGuard;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 收款人名册（仅本人）。
 */
@RestController
@RequiredArgsConstructor
public class BeneficiaryController {

    private final BeneficiaryService beneficiaryService;

    @GetMapping("/beneficiaries")
    public Result<List<Beneficiary>> list() {
        return Result.ok(beneficiaryService.list(OwnerGuard.requireCustomerId()));
    }

    @PostMapping("/beneficiaries")
    public Result<Beneficiary> add(@Valid @RequestBody BeneficiaryCmd cmd) {
        return Result.ok(beneficiaryService.add(OwnerGuard.requireCustomerId(), cmd));
    }

    @DeleteMapping("/beneficiaries/{id}")
    public Result<Boolean> delete(@PathVariable Long id) {
        beneficiaryService.delete(OwnerGuard.requireCustomerId(), id);
        return Result.ok(true);
    }
}
