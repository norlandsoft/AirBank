package com.airbank.common.feign;

import com.fasterxml.jackson.databind.ObjectMapper;
import feign.codec.ErrorDecoder;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.context.annotation.Bean;

@AutoConfiguration
@ConditionalOnClass(feign.RequestInterceptor.class)
public class FeignAutoConfig {

    @Bean
    public ForwardAuthInterceptor forwardAuthInterceptor() {
        return new ForwardAuthInterceptor();
    }

    @Bean
    public ErrorDecoder feignErrorDecoder(ObjectMapper objectMapper) {
        return new FeignErrorDecoder();
    }
}
