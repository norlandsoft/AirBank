/** 脱敏工具：后端已脱敏的列原样透传，前端兜底二次遮罩。 */

/** 账号遮罩：保留前 4 后 4（已含 * 的原样返回） */
export function maskAccount(acctNo?: string | null): string {
  if (!acctNo) return '--';
  if (acctNo.includes('*')) return acctNo;
  if (acctNo.length <= 8) return acctNo;
  return `${acctNo.slice(0, 4)}********${acctNo.slice(-4)}`;
}

/** 手机号遮罩：保留前 3 后 4 */
export function maskMobile(mobile?: string | null): string {
  if (!mobile) return '--';
  if (mobile.includes('*')) return mobile;
  if (mobile.length !== 11) return mobile;
  return `${mobile.slice(0, 3)}****${mobile.slice(7)}`;
}
