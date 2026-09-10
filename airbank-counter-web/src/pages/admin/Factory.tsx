import { useState } from 'react';
import { Alert, Button, Card, InputNumber, Typography } from 'antd';
import { factoryCustomers } from '../../api/admin';
import { fmtValue } from '../../utils/list';

/** 造数工具：批量创建培训客户（危险操作，二次确认） */
export default function Factory() {
  const [count, setCount] = useState<number | null>(10);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [done, setDone] = useState(false);

  const run = async () => {
    const n = Number(count ?? 0);
    if (!Number.isInteger(n) || n <= 0) return;
    setRunning(true);
    setDone(false);
    try {
      const data = await factoryCustomers(n);
      setResult(data);
      setDone(true);
    } catch {
      /* 拦截器已提示 */
    } finally {
      setRunning(false);
    }
  };

  const createdCount = (() => {
    if (result && typeof result === 'object' && !Array.isArray(result)) {
      const r = result as Record<string, unknown>;
      const hit = ['count', 'created', 'createdCount', 'total'].find((k) => r[k] !== undefined);
      if (hit) return Number(r[hit]);
    }
    return undefined;
  })();

  return (
    <Card title="造数工具（培训数据）">
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16, maxWidth: 640 }}
        message="该操作会批量创建培训客户与账户数据，仅供培训演示环境使用。"
      />
      <div style={{ marginBottom: 16, maxWidth: 320 }}>
        <InputNumber<number>
          style={{ width: '100%' }}
          value={count}
          onChange={(v) => setCount(typeof v === 'number' ? v : null)}
          min={1}
          max={1000}
          precision={0}
          addonBefore="数量"
          addonAfter="个客户"
        />
      </div>
      <Button type="primary" danger loading={running} onClick={run} disabled={!count}>
        批量创建客户
      </Button>
      {done && (
        <Alert
          type="success"
          showIcon
          style={{ marginTop: 16, maxWidth: 640 }}
          message={
            createdCount !== undefined
              ? `造数完成：成功创建 ${createdCount} 个客户`
              : `造数完成，返回结果：${fmtValue(result)}`
          }
          description={
            result && typeof result === 'object' ? (
              <pre style={{ margin: 0, maxHeight: 240, overflow: 'auto', fontSize: 12 }}>
                {JSON.stringify(result, null, 2)}
              </pre>
            ) : (
              <Typography.Text type="secondary">{fmtValue(result)}</Typography.Text>
            )
          }
        />
      )}
    </Card>
  );
}
