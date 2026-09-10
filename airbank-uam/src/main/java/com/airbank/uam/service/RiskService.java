package com.airbank.uam.service;

import com.airbank.common.exception.BizException;
import com.airbank.common.exception.ErrorCodes;
import com.airbank.uam.entity.Customer;
import com.airbank.uam.entity.RiskAssessment;
import com.airbank.uam.mapper.CustomerMapper;
import com.airbank.uam.mapper.RiskAssessmentMapper;
import com.airbank.uam.model.RiskSubmitCmd;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

/**
 * 风险测评：5 题加权打分 → C1~C5，有效期 1 年（docs/design/05 §1.1）。
 */
@Service
@RequiredArgsConstructor
public class RiskService {

    private final RiskAssessmentMapper riskMapper;
    private final CustomerMapper customerMapper;

    /** 每题分值 1~5，总分 5~25；区间映射 C1~C5 */
    public String scoreToLevel(int score) {
        if (score <= 8) {
            return "C1";
        }
        if (score <= 12) {
            return "C2";
        }
        if (score <= 17) {
            return "C3";
        }
        if (score <= 21) {
            return "C4";
        }
        return "C5";
    }

    @Transactional
    public String submit(RiskSubmitCmd cmd) {
        List<Integer> scores = cmd.scores();
        for (Integer s : scores) {
            if (s == null || s < 1 || s > 5) {
                throw BizException.of(ErrorCodes.PARAM_INVALID, "每题分值须为 1~5");
            }
        }
        int total = scores.stream().mapToInt(Integer::intValue).sum();
        String level = scoreToLevel(total);
        LocalDate today = LocalDate.now();

        RiskAssessment ra = new RiskAssessment();
        ra.setCustomerId(cmd.customerId());
        ra.setScore(total);
        ra.setLevel(level);
        ra.setAnswers(scores.toString());
        ra.setAssessDate(today);
        ra.setExpireDate(today.plusYears(1));
        ra.setCreatedAt(java.time.LocalDateTime.now());
        riskMapper.insert(ra);

        Customer c = customerMapper.selectById(cmd.customerId());
        if (c == null) {
            throw BizException.of(ErrorCodes.CUSTOMER_NOT_FOUND, "客户不存在");
        }
        c.setRiskLevel(level);
        c.setRiskAssessDate(today);
        customerMapper.updateById(c);
        return level;
    }

    /** 有效测评等级；缺失/过期抛 2008 */
    public String validLevel(Long customerId) {
        Customer c = customerMapper.selectById(customerId);
        if (c == null) {
            throw BizException.of(ErrorCodes.CUSTOMER_NOT_FOUND, "客户不存在");
        }
        if (c.getRiskLevel() == null || c.getRiskAssessDate() == null
                || c.getRiskAssessDate().plusYears(1).isBefore(LocalDate.now())) {
            throw BizException.of(ErrorCodes.RISK_ASSESS_MISSING, "客户缺少有效风险测评，请先完成测评");
        }
        return c.getRiskLevel();
    }

    public RiskAssessment latest(Long customerId) {
        return riskMapper.selectOne(new LambdaQueryWrapper<RiskAssessment>()
                .eq(RiskAssessment::getCustomerId, customerId)
                .orderByDesc(RiskAssessment::getId)
                .last("LIMIT 1"));
    }
}
