import { useEffect, useState } from 'react';
import { Card, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { listWealthOrders } from '../api/wealth';
import type { WealthOrderVO } from '../api/types';
import StatusBadge from '../components/StatusBadge';
import { fenToYuan } from '../utils/money';

const PAGE_SIZE = 10;

export default function WealthOrdersPage() {
  const [list, setList] = useState<WealthOrderVO[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const vo = await listWealthOrders(page, PAGE_SIZE);
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

  const columns: ColumnsType<WealthOrderVO> = [
    {
      title: '订单号',
      dataIndex: 'orderNo',
      width: 180,
      render: (v: string) => <Typography.Text copyable={false}>{v}</Typography.Text>,
    },
    {
      title: '产品',
      dataIndex: 'productCode',
      render: (v: string, record) => record.productName ? `${record.productName}（${v}）` : v,
    },
    {
      title: '类型',
      dataIndex: 'orderType',
      width: 90,
      render: (v: string) =>
        v === 'PURCHASE' ? <Tag color="blue">申购</Tag> : v === 'REDEEM' ? <Tag color="orange">赎回</Tag> : <Tag>{v}</Tag>,
    },
    { title: '金额（元）', dataIndex: 'amount', align: 'right', render: (v: string) => fenToYuan(v) },
    { title: '状态', dataIndex: 'status', width: 110, render: (v: string) => <StatusBadge status={v} /> },
    {
      title: '时间',
      dataIndex: 'createdAt',
      width: 170,
      render: (v?: string) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '--'),
    },
  ];

  return (
    <Card title="理财交易记录" extra={<Typography.Text type="secondary">订单生命周期：受理 → 扣款 → 确认 → 清算</Typography.Text>}>
      <Table<WealthOrderVO>
        rowKey="orderNo"
        loading={loading}
        columns={columns}
        dataSource={list}
        pagination={{
          current: page,
          pageSize: PAGE_SIZE,
          total,
          showSizeChanger: false,
          showTotal: (t) => `共 ${t} 笔`,
          onChange: (p) => setPage(p),
        }}
        scroll={{ x: 800 }}
      />
    </Card>
  );
}
