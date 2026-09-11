import { Descriptions, Modal, Tag } from 'antd';
import type { ReactNode } from 'react';
import type { VoucherVO } from '../api/types';
import { bizTypeLabel } from '../utils/dict';
import { fmtValue } from '../utils/list';
import { fenToYuan } from '../utils/money';

interface Props {
  voucher: VoucherVO | null;
  onClose: () => void;
}

function contentRows(content: unknown): [string, unknown][] {
  let obj: unknown = content;
  if (typeof content === 'string') {
    try {
      obj = JSON.parse(content);
    } catch {
      return [['内容', content]];
    }
  }
  if (obj && typeof obj === 'object') {
    return Object.entries(obj as Record<string, unknown>).map(([k, v]) => [
      k,
      v && typeof v === 'object' ? JSON.stringify(v) : v,
    ]);
  }
  if (content === undefined || content === null) return [];
  return [['内容', content]];
}

/** 回执详情弹窗：顶部"培训环境专用"红章 + content JSON 字段排版 */
export default function VoucherModal({ voucher, onClose }: Props) {
  if (!voucher) return null;

  const base: [string, unknown][] = [
    ['申请单号 ctNo', voucher.ctNo],
    ['核心流水号 txnNo', voucher.txnNo],
    ['业务类型', bizTypeLabel(voucher.bizType)],
    ['金额（元）', voucher.amount !== undefined && voucher.amount !== '' ? fenToYuan(voucher.amount as string | number) : undefined],
    ['状态', voucher.status],
    ['时间', voucher.createdAt],
  ];

  const items: { key: string; label: string; children: ReactNode }[] = [...base, ...contentRows(voucher.content)]
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v], i) => ({ key: `${k}-${i}`, label: k, children: fmtValue(v) }));

  return (
    <Modal open onCancel={onClose} footer={null} title="电子回执" width={640}>
      <div style={{ position: 'relative', border: '1px solid var(--ab-border, #E6EAF2)', borderRadius: 10, padding: 24 }}>
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: 12,
            right: 20,
            transform: 'rotate(-12deg)',
            border: '3px solid #DC2626',
            color: '#DC2626',
            borderRadius: 6,
            padding: '4px 12px',
            fontWeight: 700,
            fontSize: 15,
            letterSpacing: 2,
            opacity: 0.85,
            pointerEvents: 'none',
            background: 'rgba(220, 38, 38, 0.04)',
          }}
        >
          AirBank 培训环境专用
        </div>
        <div style={{ marginBottom: 12 }}>
          <Tag color="#1668DC">AirBank</Tag>
          <Tag color="red">培训凭证 · 非真实资金</Tag>
        </div>
        <Descriptions bordered column={1} size="small" items={items} />
      </div>
    </Modal>
  );
}
