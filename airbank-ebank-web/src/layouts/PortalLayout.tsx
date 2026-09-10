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
        message="AirBank 网上银行 · 培训模拟环境（非真实资金）"
        style={{ backgroundColor: '#fffbe6', borderBottom: '1px solid #ffe58f' }}
      />
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          paddingInline: 24,
          boxShadow: '0 1px 4px rgba(0, 21, 41, 0.08)',
          zIndex: 10,
        }}
      >
        <div
          style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', flexShrink: 0 }}
          onClick={() => navigate('/home')}
        >
          <BankOutlined style={{ fontSize: 24, color: BRAND_COLOR, marginRight: 8 }} />
          <Typography.Text strong style={{ fontSize: 17, color: BRAND_COLOR }}>
            AirBank 网上银行
          </Typography.Text>
        </div>
        <Menu
          mode="horizontal"
          items={menuItems}
          selectedKeys={[selectedKey]}
          onClick={({ key }) => navigate(key)}
          style={{ flex: 1, minWidth: 0, justifyContent: 'flex-end', borderBottom: 'none', paddingLeft: 16 }}
        />
        <Space style={{ flexShrink: 0, marginLeft: 12 }}>
          {user?.riskLevel ? (
            <Tag color={RISK_LEVEL_COLORS[user.riskLevel] ?? 'default'} style={{ marginRight: 0 }}>
              风险 {user.riskLevel}
            </Tag>
          ) : null}
          <Dropdown menu={{ items: userMenu }} placement="bottomRight">
            <Space style={{ cursor: 'pointer' }}>
              <Avatar size="small" icon={<UserOutlined />} style={{ backgroundColor: BRAND_COLOR }} />
              <Typography.Text>{user?.realName || user?.loginName || '客户'}</Typography.Text>
            </Space>
          </Dropdown>
        </Space>
      </Header>
      <Content style={{ padding: '20px 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <Outlet />
        </div>
      </Content>
      <Footer style={{ textAlign: 'center', color: '#999', fontSize: 12 }}>
        AirBank 培训模拟银行 · 本系统仅用于业务培训与测试，不涉及真实资金
      </Footer>
    </Layout>
  );
}
