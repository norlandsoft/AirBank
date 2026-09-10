package com.airbank.wealth.service;

import com.airbank.api.wealth.dto.ProductVO;
import com.airbank.common.exception.BizException;
import com.airbank.common.exception.ErrorCodes;
import com.airbank.wealth.entity.Product;
import com.airbank.wealth.mapper.ProductMapper;
import com.airbank.wealth.model.ProductCreateCmd;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Set;

/**
 * 产品服务：列表/详情、管理端新建/上架/下架（docs/design/04 §1）。
 * 状态机：DRAFT→ON_SALE→(SOLD_OUT|OFF_SALE)→RUNNING→SETTLING→CLOSED。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ProductService {

    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final Set<String> RISK_LEVELS = Set.of("R1", "R2", "R3");

    private final ProductMapper productMapper;

    /** 产品列表（可按状态过滤） */
    public List<ProductVO> list(String status) {
        LambdaQueryWrapper<Product> qw = new LambdaQueryWrapper<Product>().orderByAsc(Product::getProductCode);
        if (status != null && !status.isBlank()) {
            qw.eq(Product::getStatus, status);
        }
        return productMapper.selectList(qw).stream().map(this::toVo).toList();
    }

    public ProductVO get(String code) {
        return toVo(require(code));
    }

    /** 按产品编码取实体，不存在抛 4001 */
    public Product require(String code) {
        Product p = productMapper.selectOne(new LambdaQueryWrapper<Product>()
                .eq(Product::getProductCode, code));
        if (p == null) {
            throw BizException.of(ErrorCodes.PRODUCT_NOT_FOUND, "产品不存在: " + code);
        }
        return p;
    }

    /** 管理端新建（DRAFT） */
    @Transactional
    public ProductVO create(ProductCreateCmd cmd, String operator) {
        if (cmd.productCode() == null || cmd.productCode().isBlank()
                || cmd.productName() == null || cmd.productName().isBlank()) {
            throw BizException.of(ErrorCodes.PARAM_INVALID, "产品编码与名称不能为空");
        }
        if (cmd.termDays() == null || cmd.termDays() <= 0) {
            throw BizException.of(ErrorCodes.PARAM_INVALID, "期限（天）必须大于 0");
        }
        if (cmd.minAmount() == null || cmd.minAmount() <= 0 || cmd.stepAmount() == null || cmd.stepAmount() <= 0) {
            throw BizException.of(ErrorCodes.PARAM_INVALID, "起购金额与步长必须大于 0");
        }
        if (cmd.maxSingleAmount() == null || cmd.maxSingleAmount() < cmd.minAmount()) {
            throw BizException.of(ErrorCodes.PARAM_INVALID, "单笔上限不能低于起购金额");
        }
        if (cmd.raiseLimit() == null || cmd.raiseLimit() <= 0) {
            throw BizException.of(ErrorCodes.PARAM_INVALID, "募集上限必须大于 0");
        }
        BigDecimal rate = parseRate(cmd.annualRate());
        String risk = cmd.riskLevel() == null ? null : cmd.riskLevel().trim().toUpperCase();
        if (risk == null || !RISK_LEVELS.contains(risk)) {
            throw BizException.of(ErrorCodes.PARAM_INVALID, "风险等级必须为 R1/R2/R3");
        }
        if (productMapper.selectCount(new LambdaQueryWrapper<Product>()
                .eq(Product::getProductCode, cmd.productCode())) > 0) {
            throw BizException.of(ErrorCodes.DUPLICATE_REQUEST, "产品编码已存在: " + cmd.productCode());
        }
        LocalDate today = LocalDate.now();
        LocalDate raiseStart = parseDate(cmd.raiseStartDate(), today);
        LocalDate raiseEnd = parseDate(cmd.raiseEndDate(), raiseStart.plusDays(6));
        LocalDate valueDate = parseDate(cmd.valueDate(), raiseEnd.plusDays(1));

        Product p = new Product();
        p.setProductCode(cmd.productCode().trim().toUpperCase());
        p.setProductName(cmd.productName().trim());
        p.setTermDays(cmd.termDays());
        p.setAnnualRate(rate);
        p.setRiskLevel(risk);
        p.setMinAmount(cmd.minAmount());
        p.setStepAmount(cmd.stepAmount());
        p.setMaxSingleAmount(cmd.maxSingleAmount());
        p.setRaiseLimit(cmd.raiseLimit());
        p.setRaisedAmount(0L);
        p.setRaiseStartDate(raiseStart);
        p.setRaiseEndDate(raiseEnd);
        p.setValueDate(valueDate);
        p.setMaturityDate(valueDate.plusDays(cmd.termDays()));
        p.setStatus(Product.ST_DRAFT);
        p.setRedeemFeeRate(BigDecimal.ZERO);
        productMapper.insert(p);
        log.info("[product] created {} by {}", p.getProductCode(), operator);
        return toVo(p);
    }

    /** 上架：DRAFT / OFF_SALE → ON_SALE */
    @Transactional
    public ProductVO onSale(String code, String operator) {
        Product p = require(code);
        if (!Product.ST_DRAFT.equals(p.getStatus()) && !Product.ST_OFF_SALE.equals(p.getStatus())) {
            throw BizException.of(ErrorCodes.ORDER_STATUS_DENY,
                    "产品状态为 " + p.getStatus() + "，不允许上架");
        }
        p.setStatus(Product.ST_ON_SALE);
        productMapper.updateById(p);
        log.info("[product] {} on-sale by {}", code, operator);
        return toVo(p);
    }

    /** 下架：ON_SALE → OFF_SALE */
    @Transactional
    public ProductVO offSale(String code, String operator) {
        Product p = require(code);
        if (!Product.ST_ON_SALE.equals(p.getStatus())) {
            throw BizException.of(ErrorCodes.ORDER_STATUS_DENY,
                    "产品状态为 " + p.getStatus() + "，不允许下架");
        }
        p.setStatus(Product.ST_OFF_SALE);
        productMapper.updateById(p);
        log.info("[product] {} off-sale by {}", code, operator);
        return toVo(p);
    }

    public ProductVO toVo(Product p) {
        return new ProductVO(p.getId(), p.getProductCode(), p.getProductName(),
                p.getTermDays() == null ? 0 : p.getTermDays(),
                p.getAnnualRate() == null ? null : p.getAnnualRate().toPlainString(),
                p.getRiskLevel(),
                nz(p.getMinAmount()), nz(p.getStepAmount()), nz(p.getMaxSingleAmount()),
                nz(p.getRaiseLimit()), nz(p.getRaisedAmount()),
                date(p.getRaiseStartDate()), date(p.getRaiseEndDate()),
                date(p.getValueDate()), date(p.getMaturityDate()),
                p.getStatus(),
                p.getRedeemFeeRate() == null ? "0" : p.getRedeemFeeRate().toPlainString());
    }

    private long nz(Long v) {
        return v == null ? 0L : v;
    }

    private String date(LocalDate d) {
        return d == null ? null : d.format(DAY);
    }

    private BigDecimal parseRate(String rate) {
        if (rate == null || rate.isBlank()) {
            throw BizException.of(ErrorCodes.PARAM_INVALID, "业绩比较基准不能为空");
        }
        try {
            BigDecimal v = new BigDecimal(rate.trim());
            if (v.compareTo(BigDecimal.ZERO) <= 0 || v.compareTo(new BigDecimal("1")) >= 0) {
                throw BizException.of(ErrorCodes.PARAM_INVALID, "业绩比较基准须在 0~1 之间（如 0.0260）");
            }
            return v.setScale(4, java.math.RoundingMode.HALF_UP);
        } catch (NumberFormatException e) {
            throw BizException.of(ErrorCodes.PARAM_INVALID, "业绩比较基准格式不正确");
        }
    }

    private LocalDate parseDate(String s, LocalDate dft) {
        if (s == null || s.isBlank()) {
            return dft;
        }
        try {
            return LocalDate.parse(s.trim(), DAY);
        } catch (DateTimeParseException e) {
            throw BizException.of(ErrorCodes.PARAM_INVALID, "日期格式须为 yyyy-MM-dd: " + s);
        }
    }
}
