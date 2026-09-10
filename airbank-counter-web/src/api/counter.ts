import { httpGet, httpPost } from './http';
import type {
  CustomerVO,
  DashboardVO,
  DaySettleVO,
  ReviewItem,
  ShiftVO,
  TimeDepositVO,
  TxnPayload,
  TxnResult,
  VoucherVO,
  WealthProduct,
} from './types';

/** ===== 工作台 ===== */
export function getDashboard() {
  return httpGet<DashboardVO>('/counter/dashboard');
}

/** ===== 签到签退 ===== */
export function getShiftToday() {
  return httpGet<ShiftVO>('/counter/shift/today');
}
export function signIn() {
  return httpPost<unknown>('/counter/shift/sign-in');
}
export function signOut() {
  return httpPost<unknown>('/counter/shift/sign-out');
}

/** ===== 统一交易提交 ===== */
export function submitTxn(payload: TxnPayload) {
  return httpPost<TxnResult>('/counter/txns', payload);
}

/** ===== 待复核授权 ===== */
export function getPendingReviews() {
  return httpGet<ReviewItem[] | { list?: ReviewItem[] }>('/counter/review/pending');
}
export function approveReview(id: string | number) {
  return httpPost<unknown>(`/counter/review/${id}/approve`);
}
export function rejectReview(id: string | number, comment: string) {
  return httpPost<unknown>(`/counter/review/${id}/reject`, { comment });
}

/** ===== 客户查询 ===== */
export function searchCustomers(keyword: string) {
  return httpGet<CustomerVO[] | { list?: CustomerVO[] }>('/counter/customers', { keyword });
}

/** ===== 日结 ===== */
export function doDaySettlement() {
  return httpPost<DaySettleVO>('/counter/day-settlement');
}
export function getTodaySettlement() {
  return httpGet<DaySettleVO | null>('/counter/day-settlement/today');
}

/** ===== 回执 ===== */
export function getVouchers(date: string) {
  return httpGet<VoucherVO[] | { list?: VoucherVO[] }>('/counter/vouchers', { date });
}

/** ===== 理财代销 ===== */
export function getWealthProducts() {
  return httpGet<WealthProduct[] | { list?: WealthProduct[] }>('/counter/products');
}

/** ===== 定期存单（核心直查，柜面无转发） ===== */
export function getTimeDeposits(acctNo: string) {
  return httpGet<TimeDepositVO[] | { list?: TimeDepositVO[] }>('/core/time-deposits', { acctNo });
}
