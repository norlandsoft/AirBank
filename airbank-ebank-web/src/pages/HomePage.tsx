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
import { BRAND_COLOR, MONEY_IN_COLOR } from '../theme/token';
import { maskAccount } from '../utils/mask';
import { fenToYuan } from '../utils/money';

const QUICK_ENTRIES = [
  { key: '/transfer', icon: <SwapOutlined />, label: '转账汇款', tint: BRAND_COLOR },
  { key: '/wealth', icon: <FundOutlined />, label: '理财超市', tint: '#D97706' },
  { key: '/accounts', icon: <WalletOutlined />, label: '交易明细', tint: '#2563EB' },
  { key: '/receipts', icon: <FileDoneOutlined />, label: '电子回单', tint: '#7C3AED' },
];

/** 账户卡片背景：活期青绿渐变 / 定期墨蓝渐变 */
const ACCT_BG: Record<string, string> = {
  DEMAND: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 48%, #0f766e 100%)',
  TIME: 'linear-gradient(135deg, #475569 0%, #334155 55%, #1e293b 100%)',
};

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
      <Row gutter={[14, 14]}>
        <Col xs={24} sm={8}>
          <Card className="ab-hover" styles={{ body: { padding: '18px 20px' } }}>
            <Statistic title="存款总额（元）" value={fenToYuan(home?.depositTotal)} />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>含活期与定期存单</Typography.Text>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="ab-hover" styles={{ body: { padding: '18px 20px' } }}>
            <Statistic title="理财持仓（元）" value={fenToYuan(home?.wealthTotal)} />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>在途申赎不含内</Typography.Text>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="ab-hover" styles={{ body: { padding: '18px 20px' } }}>
            <Statistic
              title="昨日收益（元）"
              value={fenToYuan(home?.accruingIncome)}
              valueStyle={{ color: MONEY_IN_COLOR }}
              prefix="+"
            />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>理财计提 + 活期利息</Typography.Text>
          </Card>
        </Col>
      </Row>

      {/* 快捷入口宫格 */}
      <Card title="快捷入口" style={{ marginTop: 14 }}>
        <Row gutter={[12, 12]}>
          {QUICK_ENTRIES.map((e) => (
            <Col xs={12} sm={6} key={e.key}>
              <div
                onClick={() => navigate(e.key)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 10,
                  padding: '18px 8px 14px',
                  borderRadius: 10,
                  border: '1px solid var(--ab-border, #E4EBE9)',
                  background: '#fff',
                  cursor: 'pointer',
                  transition: 'all .22s ease',
                }}
                onMouseEnter={(ev) => {
                  ev.currentTarget.style.transform = 'translateY(-2px)';
                  ev.currentTarget.style.boxShadow = 'var(--ab-shadow-card-hover)';
                  ev.currentTarget.style.borderColor = e.tint;
                }}
                onMouseLeave={(ev) => {
                  ev.currentTarget.style.transform = 'none';
                  ev.currentTarget.style.boxShadow = 'none';
                  ev.currentTarget.style.borderColor = 'var(--ab-border, #E4EBE9)';
                }}
              >
                <span
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 11,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 20,
                    color: e.tint,
                    background: `${e.tint}14`,
                  }}
                >
                  {e.icon}
                </span>
                <span style={{ fontSize: 13 }}>{e.label}</span>
              </div>
            </Col>
          ))}
        </Row>
      </Card>

      {/* 账户列表 */}
      <Card
        title="我的账户"
        style={{ marginTop: 14 }}
        extra={<a onClick={() => navigate('/accounts')}>全部账户 <ArrowRightOutlined /></a>}
      >
        {loading ? (
          <Skeleton active />
        ) : home?.accounts?.length ? (
          <Row gutter={[14, 14]}>
            {home.accounts.map((acct) => (
              <Col xs={24} sm={12} lg={8} key={acct.acctNo}>
                <Card
                  size="small"
                  className="ab-hover"
                  style={{ background: ACCT_BG[acct.acctType] ?? ACCT_BG.DEMAND, border: 'none', borderRadius: 12 }}
                >
                  <Typography.Text style={{ color: 'rgba(255,255,255,0.78)', fontSize: 12 }}>
                    {acct.acctType === 'TIME' ? '定期账户' : '活期账户'} · {maskAccount(acct.acctNo)}
                  </Typography.Text>
                  <div style={{ margin: '8px 0 6px' }}>
                    <Typography.Text style={{ color: '#fff', fontSize: 22, fontWeight: 700 }}>
                      {fenToYuan(acct.balance)}
                    </Typography.Text>
                    <Typography.Text style={{ color: 'rgba(255,255,255,0.78)', marginLeft: 4 }}>元</Typography.Text>
                  </div>
                  <div>
                    {acct.acctName ? (
                      <Typography.Text style={{ color: 'rgba(255,255,255,0.78)', fontSize: 12, marginRight: 8 }}>
                        {acct.acctName}
                      </Typography.Text>
                    ) : null}
                    <Tag
                      style={{
                        borderRadius: 6,
                        color: '#fff',
                        background: 'rgba(255,255,255,0.16)',
                        border: '1px solid rgba(255,255,255,0.24)',
                      }}
                    >
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
      <Card title="最近交易" style={{ marginTop: 14 }}>
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
