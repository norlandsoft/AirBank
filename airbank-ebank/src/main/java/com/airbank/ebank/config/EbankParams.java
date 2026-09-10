package com.airbank.ebank.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.cloud.context.config.annotation.RefreshScope;
import org.springframework.stereotype.Component;

/**
 * 网银业务参数（Nacos airbank-biz-params.yaml / airbank-ebank.yaml 可热改）。
 * 金额单位：分。
 */
@Data
@RefreshScope
@Component
@ConfigurationProperties(prefix = "airbank.params")
public class EbankParams {

    /** 网银单笔转账限额（分），默认 ¥50,000 */
    private long ebankSingleLimit = 5_000_000L;

    /** 网银单日累计转账限额（分），默认 ¥200,000 */
    private long ebankDailyLimit = 20_000_000L;
}
