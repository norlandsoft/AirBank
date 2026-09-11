import { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Empty,
  Row,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DownloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { listAccountDetails, listAccounts, listTimeDeposits } from '../api/ebank';
import type { AccountVO, TimeDepositVO, TxnItemVO } from '../api/types';
import DirectionAmount from '../components/DirectionAmount';
import StatusBadge from '../components/StatusBadge';
import { exportCsv } from '../utils/csv';
import { maskAccount } from '../utils/mask';
import { fenToYuan, formatRate } from '../utils/money';

const PAGE_SIZE = 10;

function AccountsTab() {
  const [accounts, setAccounts] = useState<AccountVO[]>([]);
  const [deposits, setDeposits] = useState<TimeDepositVO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [a, d] = await Promise.all([listAccounts().catch(() => []), listTimeDeposits().catch(() => [])]);
        setAccounts(a ?? []);
        setDeposits(d ?? []);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const depositColumns: ColumnsType<TimeDepositVO> = [
    { title: '存单号', dataIndex: 'depositNo', render: (v: string) => <Typography.Text copyable={false}>{v}</Typography.Text> },
    { title: '期限', dataIndex: 'termMonths', width: 90, render: (v: number) => `${v} 个月` },
    { title: '年利率', dataIndex: 'annualRate', width: 100, align: 'right', render: (v: number) => formatRate(v) },
    { title: '本金（元）', dataIndex: 'amount', width: 140, align: 'right', render: (v: string) => fenToYuan(v) },
    { title: '到期日', dataIndex: 'maturityDate', width: 110, render: (v?: string) => v || '--' },
    { title: '状态', dataIndex: 'status', width: 120, render: (v: string) => <StatusBadge status={v} /> },
  ];

  return (
    <div>
      <Row gutter={[16, 16]}>
        {accounts.map((acct) => (
          <Col xs={24} sm={12} lg={8} key={acct.acctNo}>
            <Card
              loading={loading}
              size="small"
              style={
                acct.acctType === 'DEMAND'
                  ? { background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 48%, #0f766e 100%)', border: 'none', borderRadius: 12 }
                  : { background: 'linear-gradient(135deg, #475569 0%, #334155 55%, #1e293b 100%)', border: 'none', borderRadius: 12 }
              }
            >
              <Typography.Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>
                {acct.acctType === 'TIME' ? '定期账户' : '活期账户'} · {maskAccount(acct.acctNo)}
              </Typography.Text>
              <div style={{ margin: '8px 0 4px' }}>
                <Typography.Text style={{ color: '#fff', fontSize: 22, fontWeight: 600 }}>
                  {fenToYuan(acct.balance)}
                </Typography.Text>
                <Typography.Text style={{ color: 'rgba(255,255,255,0.85)', marginLeft: 4 }}>元</Typography.Text>
              </div>
              <Space>
                {acct.acctName ? (
                  <Typography.Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>{acct.acctName}</Typography.Text>
                ) : null}
                <Tag color={acct.status === 'ACTIVE' ? 'green' : acct.status === 'FROZEN' ? 'red' : 'default'}>
                  {acct.status === 'ACTIVE' ? '正常' : acct.status === 'FROZEN' ? '冻结' : acct.status}
                </Tag>
              </Space>
            </Card>
          </Col>
        ))}
        {!loading && accounts.length === 0 && (
          <Col span={24}>
            <Empty description="暂无账户" />
          </Col>
        )}
      </Row>

      <Card title="定期存单" style={{ marginTop: 16 }}>
        <Table<TimeDepositVO>
          rowKey="depositNo"
          size="small"
          loading={loading}
          columns={depositColumns}
          dataSource={deposits}
          pagination={false}
          locale={{ emptyText: <Empty description="暂无定期存单" /> }}
          scroll={{ x: 700 }}
        />
      </Card>
    </div>
  );
}

function DetailsTab() {
  const [accounts, setAccounts] = useState<AccountVO[]>([]);
  const [acctNo, setAcctNo] = useState<string | undefined>(undefined);
  const [list, setList] = useState<TxnItemVO[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    listAccounts()
      .then((a) => {
        setAccounts(a ?? []);
        const demand = (a ?? []).find((x) => x.acctType === 'DEMAND');
        if (demand) setAcctNo(demand.acctNo);
      })
      .catch(() => setAccounts([]));
  }, []);

  const load = useCallback(async () => {
    if (!acctNo) {
      setList([]);
      setTotal(0);
      return;
    }
    setLoading(true);
    try {
      const vo = await listAccountDetails(acctNo, page, PAGE_SIZE);
      setList(vo.list ?? []);
      setTotal(vo.total ?? 0);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [acctNo, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: ColumnsType<TxnItemVO> = [
    { title: '交易流水号', dataIndex: 'txnNo', width: 190 },
    { title: '交易类型', dataIndex: 'txnType', width: 130 },
    {
      title: '金额（元）',
      dataIndex: 'amount',
      align: 'right',
      width: 130,
      render: (v: string, record) => <DirectionAmount amount={v} direction={record.direction} />,
    },
    { title: '摘要', dataIndex: 'summary', ellipsis: true, render: (v?: string) => v || '--' },
    { title: '会计日期', dataIndex: 'batchDate', width: 110, render: (v?: string) => v || '--' },
  ];

  const handleExport = async () => {
    if (!acctNo) {
      message.warning('请先选择账户');
      return;
    }
    message.loading({ content: '正在生成 CSV…', key: 'csv', duration: 0 });
    try {
      // 拉取最多 2000 行用于前端导出
      const rows: TxnItemVO[] = [];
      let p = 1;
      for (; p <= 20; p++) {
        const vo = await listAccountDetails(acctNo, p, 100);
        rows.push(...(vo.list ?? []));
        if (!vo.list || vo.list.length < 100) break;
      }
      exportCsv(
        `AirBank-明细-${maskAccount(acctNo).replace(/\*/g, '')}-${dayjs().format('YYYYMMDDHHmmss')}.csv`,
        ['交易流水号', '交易类型', '金额（元）', '借贷方向', '摘要', '会计日期'],
        rows.map((t) => [
          t.txnNo,
          t.txnType,
          (Number(t.amount) / 100).toFixed(2),
          t.direction === 'DEBIT' ? '借方' : t.direction === 'CREDIT' ? '贷方' : '--',
          t.summary ?? '',
          t.batchDate ?? '',
        ]),
      );
      message.success({ content: `已导出 ${rows.length} 条明细`, key: 'csv' });
    } catch {
      message.error({ content: '导出失败', key: 'csv' });
    }
  };

  return (
    <Card
      title="交易明细"
      extra={
        <Space>
          <Select
            style={{ width: 240 }}
            placeholder="选择账户"
            value={acctNo}
            onChange={(v: string) => {
              setAcctNo(v);
              setPage(1);
            }}
            options={accounts.map((a) => ({
              value: a.acctNo,
              label: `${a.acctType === 'TIME' ? '定期' : '活期'} · ${maskAccount(a.acctNo)}（${fenToYuan(a.balance)} 元）`,
            }))}
          />
          <Button icon={<DownloadOutlined />} onClick={() => void handleExport()}>
            导出 CSV
          </Button>
        </Space>
      }
    >
      <Table<TxnItemVO>
        rowKey="txnNo"
        size="small"
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
        locale={{ emptyText: <Empty description="请选择账户或暂无交易" /> }}
        scroll={{ x: 700 }}
      />
    </Card>
  );
}

export default function AccountsPage() {
  return (
    <Tabs
      defaultActiveKey="accounts"
      items={[
        { key: 'accounts', label: '账户总览', children: <AccountsTab /> },
        { key: 'details', label: '交易明细', children: <DetailsTab /> },
      ]}
    />
  );
}
