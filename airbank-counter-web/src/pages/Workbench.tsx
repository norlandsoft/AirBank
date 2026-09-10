import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Col, Row, Statistic, Tag } from 'antd';
import { AuditOutlined, PayCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getDashboard } from '../api/counter';
import type { DashboardVO } from '../api/types';
import { useAuthStore } from '../stores/auth';
import { hasPerm } from '../utils/menu';
import { fenToYuan } from '../utils/money';

const QUICK_ENTRIES: { path: string; label: string; perm?: string }[] = [
  { path: '/biz/account-open', label: '开户', perm: 'counter:account-open' },
  { path: '/biz/cash-deposit', label: '现金存款', perm: 'counter:cash' },
  { path: '/biz/cash-withdraw', label: '现金取款', perm: 'counter:cash' },
  { path: '/biz/transfer', label: '行内转账', perm: 'counter:transfer' },
  { path: '/biz/time-deposit', label: '定期业务', perm: 'counter:time' },
  { path: '/biz/wealth', label: '理财代销', perm: 'counter:wealth' },
  { path: '/biz/account-manage', label: '账户管理', perm: 'counter:account-admin' },
  { path: '/reverse', label: '当日冲正', perm: 'counter:reverse' },
  { path: '/customer', label: '客户查询', perm: 'counter:customer-query' },
  { path: '/daysettle', label: '日结', perm: undefined },
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

  const entries = QUICK_ENTRIES.filter((e) => hasPerm(perms, e.perm));

  return (
    <Row gutter={[16, 16]}>
      <Col span={4}>
        <Card loading={loading}>
          <Statistic title="今日笔数" value={num(data?.todayCount)} suffix="笔" />
        </Card>
      </Col>
      <Col span={5}>
        <Card loading={loading}>
          <Statistic title="今日交易金额" value={money(data?.todayAmount)} prefix="¥" precision={2} />
        </Card>
      </Col>
      <Col span={5}>
        <Card loading={loading}>
          <Statistic title="今日现金收入" value={money(data?.cashIn)} prefix="¥" precision={2} valueStyle={{ color: '#389e0d' }} />
        </Card>
      </Col>
      <Col span={5}>
        <Card loading={loading}>
          <Statistic title="今日现金支出" value={money(data?.cashOut)} prefix="¥" precision={2} valueStyle={{ color: '#cf1322' }} />
        </Card>
      </Col>
      <Col span={5}>
        <Card loading={loading}>
          <Statistic title="尾箱余额" value={money(data?.boxBalance)} prefix="¥" precision={2} />
        </Card>
      </Col>
      <Col span={24}>
        <Card
          title={
            <span>
              <PayCircleOutlined /> 快捷入口
            </span>
          }
          extra={
            <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading} size="small">
              刷新
            </Button>
          }
        >
          {entries.map((e) => (
            <Button
              key={e.path}
              style={{ margin: '0 12px 12px 0' }}
              onClick={() => navigate(e.path)}
            >
              {e.label}
            </Button>
          ))}
        </Card>
      </Col>
      <Col span={24}>
        <Card loading={loading}>
          <Row align="middle" gutter={16}>
            <Col>
              <Statistic
                title="待复核授权"
                value={num(data?.pendingReviews)}
                suffix="笔"
                prefix={<AuditOutlined />}
                valueStyle={{ color: (Number(data?.pendingReviews) || 0) > 0 ? '#d46b08' : undefined }}
              />
            </Col>
            <Col>
              <Button type="primary" ghost onClick={() => navigate('/review')}>
                进入待复核
              </Button>
            </Col>
            <Col flex="auto" style={{ textAlign: 'right' }}>
              <Tag color="warning">培训模拟环境 · 非真实资金</Tag>
            </Col>
          </Row>
        </Card>
      </Col>
    </Row>
  );
}
