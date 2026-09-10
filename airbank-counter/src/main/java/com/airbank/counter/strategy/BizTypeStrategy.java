package com.airbank.counter.strategy;

import java.util.List;
import java.util.Map;

/**
 * 柜面业务执行策略（按 bizType 分发下游 Feign 调用，docs/design/05 §2.2）。
 */
public interface BizTypeStrategy {

    /** 本策略支持的业务类型 */
    List<String> bizTypes();

    /**
     * 执行下游调用（前置校验与幂等键已由受理层完成）。
     *
     * @return 下游返回摘要（txnNo/orderNo/acctNo 等，落 t_counter_txn.result）
     */
    Map<String, Object> execute(ExecContext ctx);

    /** 现金方向：非现金类返回 null */
    default CashDirection cashDirection() {
        return null;
    }
}
