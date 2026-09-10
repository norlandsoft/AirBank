package com.airbank.ebank.model;

import com.airbank.api.wealth.dto.ProductVO;

/**
 * 理财超市产品卡片：在售产品 + 风险匹配标识（canBuy=客户风险等级数值 ≥ 产品风险等级数值）。
 */
public record ProductCardVO(
        ProductVO product,
        boolean canBuy,
        String myRiskLevel
) {
}
