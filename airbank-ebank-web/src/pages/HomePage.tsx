import { useEffect, useState } from 'react';
import { Card, Col, Empty, Row, Skeleton, Statistic, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ArrowRightOutlined,
  FileDoneOutlined,
  FundOutlined,
  SwapOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getHome } from '../api/ebank';
import type { HomeVO, TxnItemVO } from '../api/types';
import DirectionAmount from '../components/DirectionAmount';
import StatusBadge from '../components/StatusBadge';
import { maskAccount } from '../utils/mask';
import { fenToYuan } from '../utils/money';

const QUICK_ENTRIES = [
  { key: '/transfer', icon: <SwapOutlined />, label: '转账汇款', color: '#0E8A8A' },
  { key: '/wealth', icon: <FundOutlined />, label: '理财超市', color: '#fa8c16' },
  { key: '/accounts', icon: <WalletOutlined />, label: '交易明细', color: '#1890ff' },
  { key: '/receipts', icon: <FileDoneOutlined />, label: '电子回单', color: '#722ed1' },
];

export default function HomePage() {
  const navigate = useNavigate();
  const [home, setHome] = useState<HomeVO | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getHome()
      .then(setHome)
      .catch(() => setHome(null))
      .finally(() => setLoading(false));
  }, []);

  const recentColumns: ColumnsType<TxnItemVO> = [
    { title: '交易流水号', dataIndex: 'txnNo', width: 200, render: (v: string) => <Typography.Text copyable={false}>{v}</Typography.Text> },
    { title: '交易类型', dataIndex: 'txnType', width: 120 },
    {
      title: '金额（元）',
      dataIndex: 'amount',
      align: 'right',
      width: 140,
      render: (v: string, record) => <DirectionAmount amount={v} direction={record.direction} />,
    },
    { title: '摘要', dataIndex: 'summary', ellipsis: true, render: (v?: string) => v || '--' },
    { title: '会计日期', dataIndex: 'batchDate', width: 110 },
    { title: '状态', dataIndex: 'status', width: 90, render: (v?: string) => <StatusBadge status={v} /> },
  ];

  return (
    <div>
      {/* 资产统计卡 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card loading={loading}>
            <Statistic title="存款总额（元）" value={fenToYuan(home?.depositTotal)} />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>含活期与定期存单</Typography.Text>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card loading={loading}>
            <Statistic title="理财持仓（元）" value={fenToYuan(home?.wealthTotal)} />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>在途申赎不含内</Typography.Text>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card loading={loading}>
            <Statistic
              title="昨日收益（元）"
              value={fenToYuan(home?.accruingIncome)}
              valueStyle={{ color: '#cf1322' }}
              prefix="+"
            />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>理财计提 + 活期利息</Typography.Text>
          </Card>
        </Col>
      </Row>

      {/* 快捷入口宫格 */}
      <Card title="快捷入口" style={{ marginTop: 16 }}>
        <Row gutter={[16, 16]}>
          {QUICK_ENTRIES.map((e) => (
            <Col xs={12} sm={6} key={e.key}>
              <div
                onClick={() => navigate(e.key)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                  padding: '16px 0',
                  borderRadius: 8,
                  cursor: 'pointer',
                  background: '#fafafa',
                  transition: 'box-shadow .2s',
                }}
                onMouseEnter={(ev) => (ev.currentTarget.style.boxShadow = '0 2px 8px rgba(14,138,138,0.25)')}
                onMouseLeave={(ev) => (ev.currentTarget.style.boxShadow = 'none')}
              >
                <span style={{ fontSize: 28, color: e.color }}>{e.icon}</span>
                <span>{e.label}</span>
              </div>
            </Col>
          ))}
        </Row>
      </Card>

      {/* 账户列表 */}
      <Card
        title="我的账户"
        style={{ marginTop: 16 }}
        extra={<a onClick={() => navigate('/accounts')}>全部账户 <ArrowRightOutlined /></a>}
      >
        {loading ? (
          <Skeleton active />
        ) : home?.accounts?.length ? (
          <Row gutter={[16, 16]}>
            {home.accounts.map((acct) => (
              <Col xs={24} sm={12} lg={8} key={acct.acctNo}>
                <Card size="small" bordered style={{ background: 'linear-gradient(135deg, #0E8A8A 0%, #0b6b6b 100%)', border: 'none' }}>
                  <Typography.Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>
                    {acct.acctType === 'TIME' ? '定期账户' : '活期账户'} · {maskAccount(acct.acctNo)}
                  </Typography.Text>
                  <div style={{ margin: '8px 0 4px' }}>
                    <Typography.Text style={{ color: '#fff', fontSize: 22, fontWeight: 600 }}>
                      {fenToYuan(acct.balance)}
                    </Typography.Text>
                    <Typography.Text style={{ color: 'rgba(255,255,255,0.85)', marginLeft: 4 }}>元</Typography.Text>
                  </div>
                  <div>
                    {acct.acctName ? (
                      <Typography.Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, marginRight: 8 }}>
                        {acct.acctName}
                      </Typography.Text>
                    ) : null}
                    <Tag color={acct.status === 'ACTIVE' ? 'green' : acct.status === 'FROZEN' ? 'red' : 'default'}>
                      {acct.status === 'ACTIVE' ? '正常' : acct.status === 'FROZEN' ? '冻结' : acct.status}
                    </Tag>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        ) : (
          <Empty description="暂无账户信息" />
        )}
      </Card>

      {/* 最近交易 */}
      <Card title="最近交易" style={{ marginTop: 16 }}>
        <Table<TxnItemVO>
          rowKey="txnNo"
          size="small"
          loading={loading}
          columns={recentColumns}
          dataSource={home?.recentTxns ?? []}
          pagination={false}
          locale={{ emptyText: <Empty description="暂无交易记录" /> }}
          scroll={{ x: 800 }}
        />
      </Card>
    </div>
  );
}
