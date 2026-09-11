import { useMemo } from 'react';
import { Avatar, Alert, Dropdown, Layout, Menu, Space, Tag, Typography } from 'antd';
import type { MenuProps } from 'antd';
import {
  BankOutlined,
  BellOutlined,
  FileDoneOutlined,
  FundOutlined,
  HomeOutlined,
  LogoutOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  SwapOutlined,
  UserOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { logout } from '../api/auth';
import { BRAND_COLOR } from '../theme/token';

const { Header, Content, Footer } = Layout;

const RISK_LEVEL_COLORS: Record<string, string> = {
  C1: 'green',
  C2: 'cyan',
  C3: 'blue',
  C4: 'orange',
  C5: 'red',
};

/** 品牌徽标：渐变圆角方块 */
function LogoBadge({ size = 30 }: { size?: number }) {
  return (
    <span className="ab-logo-badge" style={{ width: size, height: size }}>
      <BankOutlined style={{ fontSize: size * 0.52, color: '#fff' }} />
    </span>
  );
}

export default function PortalLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);

  const menuItems: MenuProps['items'] = useMemo(
    () => [
      { key: '/home', icon: <HomeOutlined />, label: '资产总览' },
      { key: '/transfer', icon: <SwapOutlined />, label: '转账汇款' },
      {
        key: '/wealth',
        icon: <FundOutlined />,
        label: '理财',
        children: [
          { key: '/wealth', label: '理财超市' },
          { key: '/wealth/holdings', label: '我的持仓' },
          { key: '/wealth/orders', label: '交易记录' },
        ],
      },
      { key: '/accounts', icon: <WalletOutlined />, label: '我的账户' },
      { key: '/receipts', icon: <FileDoneOutlined />, label: '电子回单' },
      { key: '/risk', icon: <SafetyCertificateOutlined />, label: '风险测评' },
      { key: '/messages', icon: <BellOutlined />, label: '消息中心' },
      { key: '/settings', icon: <SettingOutlined />, label: '安全设置' },
    ],
    [],
  );

  // 选中态：财富子路由高亮对应子项
  const selectedKey = useMemo(() => {
    const path = location.pathname;
    const flatKeys = ['/home', '/transfer', '/wealth', '/wealth/holdings', '/wealth/orders', '/accounts', '/receipts', '/risk', '/messages', '/settings'];
    if (flatKeys.includes(path)) return path;
    if (path.startsWith('/wealth')) return '/wealth';
    return '/home';
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // 即使登出接口失败也清理本地会话
    }
    clear();
    navigate('/login', { replace: true });
  };

  const userMenu: MenuProps['items'] = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: () => void handleLogout(),
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* 培训环境横幅 */}
      <Alert
        banner
        type="warning"
        showIcon
        message="AirBank 网上银行 · 培训模拟环境（非真实资金）"
        className="ab-banner"
      />
      <Header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          paddingInline: 24,
          backdropFilter: 'saturate(1.6) blur(10px)',
          WebkitBackdropFilter: 'saturate(1.6) blur(10px)',
          boxShadow: 'var(--ab-shadow-header)',
        }}
      >
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flexShrink: 0 }}
          onClick={() => navigate('/home')}
        >
          <LogoBadge />
          <Typography.Text strong style={{ fontSize: 16.5, letterSpacing: '0.01em' }}>
            AirBank 网上银行
          </Typography.Text>
        </div>
        <Menu
          mode="horizontal"
          items={menuItems}
          selectedKeys={[selectedKey]}
          onClick={({ key }) => navigate(key)}
          style={{ flex: 1, minWidth: 0, justifyContent: 'flex-end', borderBottom: 'none', paddingLeft: 24, background: 'transparent' }}
        />
        <Space style={{ flexShrink: 0, marginLeft: 16 }}>
          {user?.riskLevel ? (
            <Tag color={RISK_LEVEL_COLORS[user.riskLevel] ?? 'default'} style={{ marginRight: 0, borderRadius: 6 }}>
              风险 {user.riskLevel}
            </Tag>
          ) : null}
          <Dropdown menu={{ items: userMenu }} placement="bottomRight">
            <Space style={{ cursor: 'pointer', padding: '4px 8px', borderRadius: 8, transition: 'background .2s' }}>
              <Avatar size="small" icon={<UserOutlined />} style={{ backgroundColor: BRAND_COLOR, borderRadius: 8 }} />
              <Typography.Text>{user?.realName || user?.loginName || '客户'}</Typography.Text>
            </Space>
          </Dropdown>
        </Space>
      </Header>
      <Content style={{ padding: '24px 24px 40px' }}>
        <div className="ab-page" style={{ maxWidth: 1200, margin: '0 auto' }}>
          <Outlet />
        </div>
      </Content>
      <Footer
        style={{
          textAlign: 'center',
          color: 'var(--ab-text-3, #8BA09C)',
          fontSize: 12,
          borderTop: '1px solid var(--ab-border, #E4EBE9)',
          background: 'transparent',
        }}
      >
        AirBank 培训模拟银行 · 本系统仅用于业务培训与测试，不涉及真实资金
      </Footer>
    </Layout>
  );
}
