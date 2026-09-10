package com.airbank.wealth.service;

import com.airbank.api.wealth.dto.PositionVO;
import com.airbank.common.exception.BizException;
import com.airbank.common.exception.ErrorCodes;
import com.airbank.wealth.entity.IncomeRecord;
import com.airbank.wealth.entity.Position;
import com.airbank.wealth.entity.Product;
import com.airbank.wealth.mapper.IncomeRecordMapper;
import com.airbank.wealth.mapper.PositionMapper;
import com.airbank.wealth.mapper.ProductMapper;
import com.airbank.wealth.model.IncomeVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 持仓查询：按客户查持仓、持仓收益明细（docs/design/04 §8）。
 * 客户展示口径：持仓金额 = cost_amount + accruing_income（昨日含）。
 */
@Service
@RequiredArgsConstructor
public class PositionService {

    private final PositionMapper positionMapper;
    private final ProductMapper productMapper;
    private final IncomeRecordMapper incomeRecordMapper;

    public List<PositionVO> listByCustomer(Long customerId) {
        List<Position> positions = positionMapper.selectList(new LambdaQueryWrapper<Position>()
                .eq(Position::getCustomerId, customerId)
                .orderByAsc(Position::getProductCode));
        if (positions.isEmpty()) {
            return List.of();
        }
        Map<Long, Product> products = productMapper.selectList(null).stream()
                .collect(Collectors.toMap(Product::getId, Function.identity(), (a, b) -> a));
        return positions.stream().map(pos -> toVo(pos, products.get(pos.getProductId()))).toList();
    }

    /** 收益明细（按日） */
    public List<IncomeVO> incomes(Long positionId) {
        Position pos = positionMapper.selectById(positionId);
        if (pos == null) {
            throw BizException.of(ErrorCodes.NOT_FOUND, "持仓不存在: " + positionId);
        }
        return incomeRecordMapper.selectList(new LambdaQueryWrapper<IncomeRecord>()
                        .eq(IncomeRecord::getPositionId, positionId)
                        .orderByDesc(IncomeRecord::getBatchDate))
                .stream().map(r -> new IncomeVO(r.getBatchDate() == null ? null : r.getBatchDate().toString(),
                        r.getIncome(), r.getRate() == null ? null : r.getRate().toPlainString()))
                .toList();
    }

    public Position require(Long positionId) {
        Position pos = positionMapper.selectById(positionId);
        if (pos == null) {
            throw BizException.of(ErrorCodes.NOT_FOUND, "持仓不存在: " + positionId);
        }
        return pos;
    }

    private PositionVO toVo(Position pos, Product p) {
        return new PositionVO(pos.getId(), pos.getProductCode(),
                p == null ? null : p.getProductName(),
                p == null ? null : p.getRiskLevel(),
                p == null ? null : p.getStatus(),
                pos.getTotalShares() == null ? "0.00" : pos.getTotalShares().toPlainString(),
                pos.getCostAmount() == null ? 0L : pos.getCostAmount(),
                pos.getAccruingIncome() == null ? 0L : pos.getAccruingIncome(),
                pos.getPaidIncome() == null ? 0L : pos.getPaidIncome(),
                pos.getFirstBuyDate() == null ? null : pos.getFirstBuyDate().toString());
    }
}
