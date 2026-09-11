import { useEffect, useState } from 'react';
import { Button, Card, Descriptions, Divider, Modal, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { listReceipts } from '../api/ebank';
import type { ReceiptVO } from '../api/types';
import { fenToYuan } from '../utils/money';

const PAGE_SIZE = 10;

const BIZ_TYPE_TEXT: Record<string, string> = {
  TRANSFER: '转账',
  SUBSCRIBE: '理财申购',
  REDEEM: '理财赎回',
};

function ReceiptContent({ receipt }: { receipt: ReceiptVO }) {
  const content = receipt.content;
  let entries: [string, unknown][] = [];
  if (content && typeof content === 'object' && !Array.isArray(content)) {
    entries = Object.entries(content as Record<string, unknown>);
  }
  return (
    <div>
      <Descriptions column={1} size="small" bordered>
        <Descriptions.Item label="回单号">
          <Typography.Text copyable>{receipt.receiptNo}</Typography.Text>
        </Descriptions.Item>
        <Descriptions.Item label="业务类型">{BIZ_TYPE_TEXT[receipt.bizType] ?? receipt.bizType}</Descriptions.Item>
        {receipt.bizNo ? <Descriptions.Item label="业务单号">{receipt.bizNo}</Descriptions.Item> : null}
        {receipt.amount !== undefined && receipt.amount !== null ? (
          <Descriptions.Item label="金额（元）">{fenToYuan(receipt.amount)}</Descriptions.Item>
        ) : null}
        {receipt.createdAt ? (
          <Descriptions.Item label="生成时间">{dayjs(receipt.createdAt).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
        ) : null}
      </Descriptions>

      {entries.length > 0 && (
        <>
          <Divider orientation="left" plain style={{ fontSize: 12 }}>
            回单明细
          </Divider>
          <pre
            style={{
              background: 'var(--ab-bg-layout, #F3F7F6)',
              border: '1px solid var(--ab-border, #E4EBE9)',
              borderRadius: 6,
              padding: 12,
              fontSize: 13,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}
          >
            {entries.map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v)}`).join('\n')}
          </pre>
        </>
      )}
      {typeof content === 'string' && (
        <pre
          style={{
            background: 'var(--ab-bg-layout, #F3F7F6)',
            border: '1px solid var(--ab-border, #E4EBE9)',
            borderRadius: 6,
            padding: 12,
            fontSize: 13,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}
        >
          {content}
        </pre>
      )}

      <Divider style={{ margin: '12px 0' }} />
      <div style={{ textAlign: 'center' }}>
        <Tag color="gold">培训环境 · 本回单仅用于培训演示，非真实凭证</Tag>
      </div>
    </div>
  );
}

export default function ReceiptsPage() {
  const [list, setList] = useState<ReceiptVO[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState<ReceiptVO | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const vo = await listReceipts(page, PAGE_SIZE);
        if (!cancelled) {
          setList(vo.list ?? []);
          setTotal(vo.total ?? 0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [page]);

  const columns: ColumnsType<ReceiptVO> = [
    { title: '回单号', dataIndex: 'receiptNo', render: (v: string) => <Typography.Text copyable={false}>{v}</Typography.Text> },
    {
      title: '业务类型',
      dataIndex: 'bizType',
      width: 110,
      render: (v: string) => BIZ_TYPE_TEXT[v] ?? v,
    },
    {
      title: '金额（元）',
      dataIndex: 'amount',
      align: 'right',
      width: 130,
      render: (v?: string) => (v !== undefined && v !== null ? fenToYuan(v) : '--'),
    },
    {
      title: '生成时间',
      dataIndex: 'createdAt',
      width: 170,
      render: (v?: string) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '--'),
    },
    {
      title: '操作',
      width: 90,
      render: (_, record) => (
        <Button type="link" size="small" onClick={() => setCurrent(record)}>
          查看
        </Button>
      ),
    },
  ];

  return (
    <Card title="电子回单">
      <Table<ReceiptVO>
        rowKey="receiptNo"
        loading={loading}
        columns={columns}
        dataSource={list}
        pagination={{
          current: page,
          pageSize: PAGE_SIZE,
          total,
          showSizeChanger: false,
          showTotal: (t) => `共 ${t} 张`,
          onChange: (p) => setPage(p),
        }}
        scroll={{ x: 700 }}
      />
      <Modal
        title="电子回单详情"
        open={!!current}
        onCancel={() => setCurrent(null)}
        footer={null}
        width={520}
      >
        {current && <ReceiptContent receipt={current} />}
      </Modal>
    </Card>
  );
}
