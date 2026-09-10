package com.airbank.ebank.model;

import com.airbank.api.core.dto.AccountVO;
import com.airbank.api.core.dto.TimeDepositVO;
import com.airbank.api.core.dto.TxnVO;
import com.airbank.api.wealth.dto.PositionVO;

import java.util.List;

/**
 * 资产总览（docs/design/05 §3.4）。金额单位：分。
 */
public record HomeVO(
        String customerName,
        String riskLevel,
        List<AccountVO> accounts,
        long depositTotal,
        List<TimeDepositVO> timeDeposits,
        List<PositionVO> positions,
        long wealthTotal,
        long accruingIncome,
        List<TxnVO> recentTxns
) {
}
