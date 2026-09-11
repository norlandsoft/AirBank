import { Tag } from 'antd';

/** 产品风险等级色标：R1 绿 / R2 琥珀 / R3 红 */
const RISK_META: Record<string, { color: string; text: string }> = {
  R1: { color: '#16A34A', text: 'R1 低风险' },
  R2: { color: '#D97706', text: 'R2 中风险' },
  R3: { color: '#DC2626', text: 'R3 高风险' },
};

export function riskRank(level?: string | null): number {
  if (level === 'R1') return 1;
  if (level === 'R2') return 2;
  if (level === 'R3') return 3;
  return 0;
}

export default function RiskTag({ level }: { level?: string | null }) {
  if (!level) return <span>--</span>;
  const meta = RISK_META[level] ?? { color: 'default', text: level };
  return (
    <Tag style={{ color: meta.color === 'default' ? undefined : meta.color, borderColor: meta.color === 'default' ? undefined : meta.color }}>
      {meta.text}
    </Tag>
  );
}
