package com.airbank.api.loan.dto;

/**
 * 还款命令。repayMode：INSTALLMENT 还最早未还一期；SETTLE 提前结清。
 * 还款金额由信贷系统按计划权威计算，渠道不传金额。
 */
public record LoanRepayCmd(
        String requestNo,
        String loanNo,
        Long customerId,
        String acctNo,
        String repayMode,
        String channel,
        String operator
) {
}
