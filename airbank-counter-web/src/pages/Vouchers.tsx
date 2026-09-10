import { useCallback, useEffect, useState } from 'react';
import { Button, Card, DatePicker, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { getVouchers } from '../api/counter';
import type { VoucherVO } from '../api/types';
import VoucherModal from '../components/VoucherModal';
import { bizTypeLabel } from '../utils/dict';
import { asList, fmtValue } from '../utils/list';
import { fenToYuan } from '../utils/money';

/** 回执查询：按日期查询回执列表，点击查看详情（培训红章样式） */
export default function Vouchers() {
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [list, setList] = useState<VoucherVO[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<VoucherVO | null>(null);

  const load = useCallback(async (d: string) => {
    setLoading(true);
    try {
      setList(asList<VoucherVO>(await getVouchers(d)));
    } catch {
      /* 拦截器已提示 */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(dayjs().format('YYYY-MM-DD'));
  }, [load]);

  const columns: ColumnsType<VoucherVO> = [
    { title: '申请单号', dataIndex: 'ctNo', render: (v: unknown) => fmtValue(v) },
    { title: '核心流水号', dataIndex: 'txnNo', render: (v: unknown) => fmtValue(v) },
    { title: '业务类型', dataIndex: 'bizType', render: (v: string) => bizTypeLabel(v) },
    { title: '金额（元）', dataIndex: 'amount', align: 'right', render: (v: unknown) => fenToYuan(v as string | number) },
    { title: '状态', dataIndex: 'status', render: (v: unknown) => fmtValue(v) },
    { title: '时间', dataIndex: 'createdAt', render: (v: unknown) => fmtValue(v) },
    {
      title: '操作',
      render: (_, r) => (
        <Button type="link" size="small" onClick={() => setSelected(r)}>
          查看回执
        </Button>
      ),
    },
  ];

  return (
    <Card title="回执查询">
      <div style={{ marginBottom: 16 }}>
        <DatePicker
          value={dayjs(date)}
          allowClear={false}
          onChange={(d) => {
            if (d) {
              const fmt = d.format('YYYY-MM-DD');
              setDate(fmt);
              void load(fmt);
            }
          }}
        />
      </div>
      <Table<VoucherVO>
        rowKey={(r) => String(r.ctNo ?? r.txnNo ?? Math.random())}
        size="small"
        loading={loading}
        columns={columns}
        dataSource={list}
        pagination={false}
        onRow={(r) => ({ onClick: () => setSelected(r), style: { cursor: 'pointer' } })}
      />
      <VoucherModal voucher={selected} onClose={() => setSelected(null)} />
    </Card>
  );
}
