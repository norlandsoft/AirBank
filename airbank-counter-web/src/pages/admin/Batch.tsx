import { useState } from 'react';
import { Alert, Button, Card, Col, Popconfirm, Row, Space, Typography } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import { batchDayEnd, batchWealth } from '../../api/admin';
import { fmtValue } from '../../utils/list';

interface BatchResult {
  label: string;
  ok: boolean;
  data: string;
}

const WEALTH_TYPES: { type: string; label: string }[] = [
  { type: 'confirm', label: '理财确认批量' },
  { type: 'accrual', label: '理财计提批量' },
  { type: 'settle', label: '理财清算批量' },
  { type: 'recon', label: '理财对账批量' },
];

/** 日终批量：核心日终 + 理财 confirm/accrual/settle/recon 批量触发（危险操作二次确认） */
export default function Batch() {
  const [running, setRunning] = useState<string | null>(null);
  const [results, setResults] = useState<BatchResult[]>([]);

  const run = async (key: string, label: string, fn: () => Promise<unknown>) => {
    setRunning(key);
    try {
      const data = await fn();
      setResults((prev) => [{ label, ok: true, data: JSON.stringify(data ?? 'ok', null, 2) }, ...prev].slice(0, 10));
    } catch {
      setResults((prev) => [{ label, ok: false, data: '执行失败（详见页面顶部错误提示）' }, ...prev].slice(0, 10));
    } finally {
      setRunning(null);
    }
  };

  return (
    <Row gutter={[16, 16]}>
      <Col span={24}>
        <Card title="核心日终">
          <Space wrap>
            <Popconfirm title="确认触发核心日终批量？（日终轧账、总账计提、批量过账）">
              <Button
                type="primary"
                danger
                icon={<ThunderboltOutlined />}
                loading={running === 'day-end'}
                onClick={() => void run('day-end', '核心日终批量', batchDayEnd)}
              >
                触发核心日终
              </Button>
            </Popconfirm>
          </Space>
        </Card>
      </Col>
      <Col span={24}>
        <Card title="理财批量">
          <Space wrap>
            {WEALTH_TYPES.map((w) => (
              <Popconfirm key={w.type} title={`确认触发${w.label}？`}>
                <Button
                  loading={running === `wealth-${w.type}`}
                  onClick={() => void run(`wealth-${w.type}`, w.label, () => batchWealth(w.type))}
                >
                  {w.label}
                </Button>
              </Popconfirm>
            ))}
          </Space>
        </Card>
      </Col>
      <Col span={24}>
        <Card title="执行结果（最近 10 条）">
          {results.length === 0 ? (
            <Typography.Text type="secondary">暂无执行记录。批量任务为危险操作，执行前请二次确认。</Typography.Text>
          ) : (
            <Space direction="vertical" style={{ width: '100%' }}>
              {results.map((r, i) => (
                <Alert
                  key={i}
                  type={r.ok ? 'success' : 'error'}
                  showIcon
                  message={r.label}
                  description={<pre style={{ margin: 0, maxHeight: 200, overflow: 'auto', fontSize: 12 }}>{fmtValue(r.data)}</pre>}
                />
              ))}
            </Space>
          )}
        </Card>
      </Col>
    </Row>
  );
}
