/**
 * 金额工具：后端统一为 long 分（Long → 字符串序列化），前端负责分↔元与千分位展示。
 */

/** 分 → 千分位元字符串（如 5000000 → "50,000.00"）；非法输入返回 "0.00" */
export function fenToYuan(fen?: string | number | null): string {
  if (fen === null || fen === undefined || fen === '') return '0.00';
  const n = typeof fen === 'string' ? Number(fen) : fen;
  if (!Number.isFinite(n)) return '0.00';
  return (n / 100).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** 元（表单输入）→ 分（提交后端） */
export function yuanToFen(yuan?: string | number | null): number {
  if (yuan === null || yuan === undefined || yuan === '') return 0;
  const n = typeof yuan === 'string' ? Number(yuan) : yuan;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

/** 小数利率（如 0.026）→ 百分比文本（"2.60%"） */
export function formatRate(rate?: string | number | null): string {
  if (rate === null || rate === undefined || rate === '') return '--';
  const n = typeof rate === 'string' ? Number(rate) : rate;
  if (!Number.isFinite(n)) return '--';
  return `${(n * 100).toFixed(2)}%`;
}

/** 带符号的金额文本：借方红色（-）、贷方绿色（+） */
export function signedAmountText(
  amount?: string | number | null,
  direction?: string | null,
): { text: string; color?: string } {
  const yuan = fenToYuan(amount);
  if (direction === 'DEBIT' || direction === 'DR' || direction === 'OUT') {
    return { text: `-${yuan}`, color: '#cf1322' };
  }
  if (direction === 'CREDIT' || direction === 'CR' || direction === 'IN') {
    return { text: `+${yuan}`, color: '#389e0d' };
  }
  return { text: yuan };
}
