import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Descriptions, Modal, Popconfirm, Tag } from 'antd';
import { doDaySettlement, getTodaySettlement } from '../api/counter';
import type { DaySettleVO } from '../api/types';
import { fmtValue } from '../utils/list';
import { fenToYuan } from '../utils/money';

function countOf(v: DaySettleVO | null | undefined): string {
  if (!v) return '-';
  const c = v.totalCount ?? v.txnCount;
  return c === undefined || c === null ? '-' : String(c);
}
function sumOf(v: DaySettleVO | null | undefined, keys: (keyof DaySettleVO)[]): string {
  if (!v) return '-';
  for (const k of keys) {
    const val = v[k];
    if (val !== undefined && val !== null && val !== '') return `¥ ${fenToYuan(val as string | number)}`;
  }
  return '-';
}

/** 日结签退：执行日结 + 查看当日日结结果（笔数 / 借贷合计 / 尾箱核对） */
export default function DaySettle() {
  const [today, setToday] = useState<DaySettleVO | null>(null);
  const [result, setResult] = useState<DaySettleVO | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getTodaySettlement();
      setToday(r ?? null);
    } catch {
      /* 拦截器已提示 */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const doSettle = async () => {
    setSubmitting(true);
    try {
      const r = await doDaySettlement();
      setResult(r ?? null);
      Modal.success({
        title: '日结完成',
        content: '当日账务已轧账，尾箱核对结果见下方明细。',
      });
      await load();
    } catch {
      /* 拦截器已提示 */
    } finally {
      setSubmitting(false);
    }
  };

  const shown = result ?? today;
  const balanced = shown ? shown.balanced ?? shown.boxBalanced : undefined;

  return (
    <Card
      title="日结签退"
      loading={loading}
      extra={
        <Popconfirm title="确认执行当日日结？日结后当日账务轧账封账。" onConfirm={() => void doSettle()}>
          <Button type="primary" loading={submitting}>
            执行日结
          </Button>
        </Popconfirm>
      }
    >
      {!shown ? (
        <Alert type="info" showIcon message="今日尚未日结。请确认当日业务全部办理完毕后，点击右上角「执行日结」。" />
      ) : (
        <Descriptions bordered column={1} size="small" style={{ maxWidth: 620 }} items={[
          { key: 'date', label: '日结日期', children: fmtValue(shown.date) },
          { key: 'count', label: '交易笔数', children: countOf(shown) },
          { key: 'dr', label: '借方合计（元）', children: sumOf(shown, ['debitSum', 'drSum']) },
          { key: 'cr', label: '贷方合计（元）', children: sumOf(shown, ['creditSum', 'crSum']) },
          {
            key: 'box',
            label: '尾箱核对',
            children: balanced === undefined ? '-' : balanced ? <Tag color="success">轧账平衡 balanced</Tag> : <Tag color="error">账实不符，请检查</Tag>,
          },
        ]} />
      )}
    </Card>
  );
}
