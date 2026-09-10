package com.airbank.core.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.cloud.context.config.annotation.RefreshScope;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 业务参数（Nacos airbank-biz-params.yaml 可热改，docs/design/02 §7.2）。
 */
@Data
@RefreshScope
@Component
@ConfigurationProperties(prefix = "airbank.params")
public class CoreParams {

    /** 活期年利率（小数） */
    private double demandRate = 0.0030;
    /** 定期利率表 "3:0.0115,6:0.0135,..."（月:年利率） */
    private String timeRates = "3:0.0115,6:0.0135,12:0.0155,24:0.0185,36:0.0220";
    /** 定期起存（分） */
    private long timeDepositMin = 100000;
    /** 日终批量 cron */
    private String batchCron = "0 35 23 * * ?";

    public Map<Integer, Double> timeRateMap() {
        Map<Integer, Double> m = new LinkedHashMap<>();
        for (String pair : timeRates.split(",")) {
            String[] kv = pair.split(":");
            m.put(Integer.valueOf(kv[0].trim()), Double.parseDouble(kv[1].trim()));
        }
        return m;
    }

    public double rateFor(int termMonths) {
        Double r = timeRateMap().get(termMonths);
        if (r == null) {
            throw com.airbank.common.exception.BizException.of(
                    com.airbank.common.exception.ErrorCodes.PARAM_INVALID, "不支持的定期档期（月）: " + termMonths);
        }
        return r;
    }
}
