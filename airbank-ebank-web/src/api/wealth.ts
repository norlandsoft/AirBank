import { get, post } from './http';
import type { PageResult, WealthOrderVO, WealthPositionVO, WealthProductVO } from './types';

/** GET /api/ebank/wealth/products：理财超市（含募集进度/可购状态） */
export function listWealthProducts(): Promise<WealthProductVO[]> {
  return get<WealthProductVO[]>('/ebank/wealth/products');
}

export interface SubscribeCmd {
  requestNo: string;
  productCode: string;
  /** 单位：分 */
  amount: number;
  otpCode: string;
}

/** POST /api/ebank/wealth/subscribe：申购（渠道编排：扣款 + 理财下单） */
export function subscribeWealth(cmd: SubscribeCmd): Promise<{ orderNo?: string }> {
  return post<{ orderNo?: string }>('/ebank/wealth/subscribe', cmd);
}

export interface RedeemCmd {
  requestNo: string;
  productCode: string;
  /** 赎回份额（1 元 = 1 份，金额分即份额） */
  shares: number;
  otpCode: string;
}

/** POST /api/ebank/wealth/redeem：赎回 */
export function redeemWealth(cmd: RedeemCmd): Promise<{ orderNo?: string }> {
  return post<{ orderNo?: string }>('/ebank/wealth/redeem', cmd);
}

/** GET /api/ebank/wealth/positions：我的持仓 */
export function listWealthPositions(): Promise<WealthPositionVO[]> {
  return get<WealthPositionVO[]>('/ebank/wealth/positions');
}

/** GET /api/ebank/wealth/orders：理财交易记录（分页） */
export function listWealthOrders(
  pageNum: number,
  pageSize: number,
): Promise<PageResult<WealthOrderVO>> {
  return get<PageResult<WealthOrderVO>>('/ebank/wealth/orders', { pageNum, pageSize });
}
