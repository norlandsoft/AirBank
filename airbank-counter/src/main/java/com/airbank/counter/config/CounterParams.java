package com.airbank.counter.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.cloud.context.config.annotation.RefreshScope;
import org.springframework.stereotype.Component;

/**
 * 柜面业务参数（Nacos airbank-biz-params.yaml 可热改，docs/design/05 §2.2）。
 */
@Data
@RefreshScope
@Component
@ConfigurationProperties(prefix = "airbank.params")
public class CounterParams {

    /** 大额授权阈值（分）：现金存取/转账/理财申购/定期存入 金额≥阈值需主管授权 */
    private long authorizeThreshold = 5_000_000L;

    /** 柜员尾箱限额（分）：现金流入后超限拒绝（5003） */
    private long cashBoxLimit = 20_000_000L;
}
