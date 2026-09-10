/** 业务类型中文名 */
export const BIZ_TYPE_LABELS: Record<string, string> = {
  ACCOUNT_OPEN: '开户',
  CASH_DEPOSIT: '现金存款',
  CASH_WITHDRAW: '现金取款',
  INNER_TRANSFER: '行内转账',
  TIME_DEPOSIT_IN: '定期存入',
  TIME_DEPOSIT_BREAK: '定期支取',
  WEALTH_SUBSCRIBE: '理财申购',
  WEALTH_REDEEM: '理财赎回',
  ACCOUNT_FREEZE: '账户冻结',
  ACCOUNT_UNFREEZE: '账户解冻',
  ACCOUNT_STOP_PAYMENT: '账户止付',
  ACCOUNT_RESUME_PAYMENT: '解除止付',
  ACCOUNT_CLOSE: '销户',
  REVERSE: '当日冲正',
};

export function bizTypeLabel(v?: string | null): string {
  if (!v) return '-';
  return BIZ_TYPE_LABELS[v] ?? v;
}

/** 风险等级 → 标签颜色 */
export const RISK_COLORS: Record<string, string> = {
  R1: 'green',
  R2: 'blue',
  R3: 'orange',
  R4: 'volcano',
  R5: 'red',
  C1: 'green',
  C2: 'blue',
  C3: 'orange',
  C4: 'volcano',
  C5: 'red',
};

/** 柜员状态 */
export function tellerStatusTag(v?: string | null): { label: string; color: string } {
  switch (v) {
    case 'ACTIVE':
    case 'ENABLED':
      return { label: '启用', color: 'green' };
    case 'LOCKED':
      return { label: '锁定', color: 'orange' };
    case 'DISABLED':
    case 'INACTIVE':
      return { label: '停用', color: 'red' };
    default:
      return { label: v ?? '-', color: 'default' };
  }
}
