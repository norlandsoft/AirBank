import { fenToYuan } from '../utils/money';

/** 带借贷方向的金额展示：借方红（-）/ 贷方绿（+） */
export default function DirectionAmount({
  amount,
  direction,
}: {
  amount?: string | number | null;
  direction?: string | null;
}) {
  const yuan = fenToYuan(amount);
  if (direction === 'DEBIT' || direction === 'DR' || direction === 'OUT') {
    return <span style={{ color: '#cf1322' }}>-{yuan}</span>;
  }
  if (direction === 'CREDIT' || direction === 'CR' || direction === 'IN') {
    return <span style={{ color: '#389e0d' }}>+{yuan}</span>;
  }
  return <span>{yuan}</span>;
}
