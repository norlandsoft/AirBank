import { httpGet, httpPost, httpPut } from './http';
import type { TellerVO } from './types';

/** ===== 柜员管理（用户中心） ===== */
export function listTellers() {
  return httpGet<TellerVO[] | { list?: TellerVO[] }>('/uam/users/tellers');
}
export function createTeller(payload: {
  tellerNo: string;
  realName: string;
  branchNo: string;
  roleCode: string;
  password: string;
}) {
  return httpPost<unknown>('/uam/users/tellers', payload);
}
export function resetTellerPassword(id: string | number, password: string) {
  return httpPut<unknown>(`/uam/users/tellers/${id}/reset-password`, { password });
}

/** ===== 参数查看 ===== */
export function getParams() {
  return httpGet<unknown>('/counter/admin/params');
}

/** ===== 日终批量 ===== */
export function batchDayEnd() {
  return httpPost<unknown>('/counter/admin/batch/day-end');
}
export function batchWealth(type: string) {
  return httpPost<unknown>('/counter/admin/batch/wealth', undefined, { params: { type } });
}

/** ===== 造数 ===== */
export function factoryCustomers(count: number) {
  return httpPost<unknown>('/counter/admin/factory/customers', { count });
}
