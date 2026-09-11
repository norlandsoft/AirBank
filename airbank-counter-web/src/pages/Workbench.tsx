import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Card, Col, Row, Statistic, Tag } from 'antd';
import {
  ArrowRightOutlined,
  AuditOutlined,
  BankOutlined,
  DashboardOutlined,
  FundOutlined,
  PayCircleOutlined,
  ReloadOutlined,
  RollbackOutlined,
  SearchOutlined,
  SwapOutlined,
  TeamOutlined,
  UserAddOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getDashboard } from '../api/counter';
import type { DashboardVO } from '../api/types';
import { useAuthStore } from '../stores/auth';
import { MONEY_IN_COLOR, MONEY_OUT_COLOR, WARN_COLOR } from '../theme/token';
import { hasPerm } from '../utils/menu';
import { fenToYuan } from '../utils/money';

const QUICK_ENTRIES: { path: string; label: string; icon: ReactNode; tint: string; perm?: string }[] = [
  { path: '/biz/account-open', label: '开户', icon: <UserAddOutlined />, tint: '#1668DC', perm: 'counter:account-open' },
  { path: '/biz/cash-deposit', label: '现金存款', icon: <PayCircleOutlined />, tint: '#16A34A', perm: 'counter:cash' },
  { path: '/biz/cash-withdraw', label: '现金取款', icon: <WalletOutlined />, tint: '#D97706', perm: 'counter:cash' },
  { path: '/biz/transfer', label: '行内转账', icon: <SwapOutlined />, tint: '#7C3AED', perm: 'counter:transfer' },
  { path: '/biz/time-deposit', label: '定期业务', icon: <BankOutlined />, tint: '#0E7490', perm: 'counter:time' },
  { path: '/biz/wealth', label: '理财代销', icon: <FundOutlined />, tint: '#DB2777', perm: 'counter:wealth' },
  { path: '/biz/account-manage', label: '账户管理', icon: <TeamOutlined />, tint: '#475569', perm: 'counter:account-admin' },
  { path: '/reverse', label: '当日冲正', icon: <RollbackOutlined />, tint: '#DC2626', perm: 'counter:reverse' },
  { path: '/customer', label: '客户查询', icon: <SearchOutlined />, tint: '#0891B2', perm: 'counter:customer-query' },
  { path: '/daysettle', label: '日结', icon: <DashboardOutlined />, tint: '#52525B' },
];

/** 工作台：今日统计卡 + 待复核 + 快捷入口 */
export default function Workbench() {
  const navigate = useNavigate();
  const perms = useAuthStore((s) => s.perms);
  const [data, setData] = useState<DashboardVO | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getDashboard());
    } catch {
      /* 拦截器已提示 */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 30000);
    return () => window.clearInterval(timer);
  }, [load]);

  const num = (v: string | number | undefined): string => (v === undefined || v === null || v === '' ? '0' : String(v));
  const money = (v: string | number | undefined): string => fenToYuan(v as string | number);

  const pendingReviews = Number(data?.pendingReviews) || 0;
  const entries = QUICK_ENTRIES.filter((e) => hasPerm(perms, e.perm));

  const statCards = [
    { title: '今日笔数', value: num(data?.todayCount), suffix: '笔', color: '#1668DC' },
    { title: '今日交易金额', value: money(data?.todayAmount), prefix: '¥' },
    { title: '今日现金收入', value: money(data?.cashIn), prefix: '¥', color: MONEY_IN_COLOR },
    { title: '今日现金支出', value: money(data?.cashOut), prefix: '¥', color: MONEY_OUT_COLOR },
    { title: '尾箱余额', value: money(data?.boxBalance), prefix: '¥' },
  ];

  return (
    <div>
      {/* 今日统计 */}
      <Row gutter={[14, 14]}>
        {statCards.map((s) => (
          <Col xs={12} sm={12} lg={4} xxl={4} key={s.title} flex="1" style={{ minWidth: 180 }}>
            <Card className="ab-hover" loading={loading} styles={{ body: { padding: '16px 18px' } }}>
              <Statistic
                title={s.title}
                value={s.value}
                prefix={s.prefix}
                suffix={s.suffix}
                precision={s.suffix ? undefined : 2}
                valueStyle={s.color ? { color: s.color } : undefined}
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* 待复核授权 */}
      <Card className="ab-hover" style={{ marginTop: 14 }} styles={{ body: { padding: '14px 20px' } }}>
        <Row align="middle" gutter={16}>
          <Col flex="none">
            <span
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                color: pendingReviews > 0 ? WARN_COLOR : '#8A97AD',
                background: pendingReviews > 0 ? 'rgba(217, 119, 6, 0.1)' : 'var(--ab-bg-layout, #F4F6FA)',
                transition: 'all .2s',
              }}
            >
              <AuditOutlined />
            </span>
          </Col>
          <Col flex="none">
            <Statistic
              title="待复核授权"
              value={num(data?.pendingReviews)}
              suffix="笔"
              valueStyle={{ fontSize: 20, color: pendingReviews > 0 ? WARN_COLOR : undefined }}
            />
          </Col>
          <Col flex="none">
            <Button type="primary" ghost onClick={() => navigate('/review')} icon={<ArrowRightOutlined />}>
              进入待复核
            </Button>
          </Col>
          <Col flex="auto" style={{ textAlign: 'right' }}>
            <Tag color="warning" style={{ borderRadius: 6 }}>
              培训模拟环境 · 非真实资金
            </Tag>
          </Col>
        </Row>
      </Card>

      {/* 快捷入口 */}
      <Card
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <PayCircleOutlined style={{ color: '#1668DC' }} />
            快捷入口
          </span>
        }
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading} size="small">
            刷新
          </Button>
        }
        style={{ marginTop: 14 }}
      >
        <Row gutter={[12, 12]}>
          {entries.map((e) => (
            <Col xs={12} sm={8} md={6} xl={3} xxl={2} key={e.path} style={{ minWidth: 96 }}>
              <div
                onClick={() => navigate(e.path)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 10,
                  padding: '18px 8px 14px',
                  borderRadius: 10,
                  border: '1px solid var(--ab-border, #E6EAF2)',
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
                  ev.currentTarget.style.borderColor = 'var(--ab-border, #E6EAF2)';
                }}
              >
                <span
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 11,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 19,
                    color: e.tint,
                    background: `${e.tint}14`,
                  }}
                >
                  {e.icon}
                </span>
                <span style={{ fontSize: 13, color: 'var(--ab-text-1, #1F2D3D)' }}>{e.label}</span>
              </div>
            </Col>
          ))}
        </Row>
      </Card>
    </div>
  );
}
