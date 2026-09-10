package com.airbank.counter.strategy;

import com.airbank.common.exception.BizException;
import com.airbank.common.exception.ErrorCodes;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * bizType → 策略注册器。
 */
@Component
public class BizStrategyRegistry {

    private final Map<String, BizTypeStrategy> strategies = new HashMap<>();

    public BizStrategyRegistry(List<BizTypeStrategy> list) {
        for (BizTypeStrategy s : list) {
            for (String bizType : s.bizTypes()) {
                BizTypeStrategy prev = strategies.put(bizType, s);
                if (prev != null) {
                    throw new IllegalStateException("重复注册的 bizType 策略: " + bizType);
                }
            }
        }
    }

    public BizTypeStrategy of(String bizType) {
        BizTypeStrategy s = strategies.get(bizType);
        if (s == null) {
            throw BizException.of(ErrorCodes.PARAM_INVALID, "不支持的 bizType: " + bizType);
        }
        return s;
    }

    public boolean supports(String bizType) {
        return bizType != null && strategies.containsKey(bizType);
    }
}
