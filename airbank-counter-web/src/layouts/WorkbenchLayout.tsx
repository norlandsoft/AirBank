import { useMemo } from 'react';
import { Alert, Dropdown } from 'antd';
import { BankOutlined, LogoutOutlined, UserOutlined } from '@ant-design/icons';
import type { MenuDataItem, ProLayoutProps } from '@ant-design/pro-components';
import { ProLayout } from '@ant-design/pro-components';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { logout } from '../api/auth';
import { useAuthStore } from '../stores/auth';
import { BRAND_COLOR, NAVY_COLOR, TRAINING_BANNER } from '../theme/token';
import { menuIcon } from '../utils/icons';
import { DEFAULT_MENUS, filterMenus } from '../utils/menu';
import type { MenuNode } from '../api/types';

function toMenuData(menus: MenuNode[]): MenuDataItem[] {
  return menus.map((m) => ({
    path: m.path || `/${m.key ?? m.name ?? ''}`,
    name: m.name,
    icon: menuIcon(m.icon),
    children: m.children && m.children.length > 0 ? toMenuData(m.children) : undefined,
  }));
}

/** 品牌徽标：渐变圆角方块 */
function LogoBadge({ size = 28 }: { size?: number }) {
  return (
    <span className="ab-logo-badge" style={{ width: size, height: size }}>
      <BankOutlined style={{ fontSize: size * 0.52, color: '#fff' }} />
    </span>
  );
}

/** 柜面工作台布局：深蓝侧栏 + 白色顶栏 + 培训环境横幅 */
export default function WorkbenchLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuthStore();

  const visibleMenus = useMemo(
    () => filterMenus(auth.menus.length > 0 ? auth.menus : DEFAULT_MENUS, auth.perms),
    [auth.menus, auth.perms],
  );
  const menuData = useMemo(() => toMenuData(visibleMenus), [visibleMenus]);

  const doLogout = async () => {
    await logout();
    auth.clear();
    navigate('/login', { replace: true });
  };

  return (
    <ProLayout
      title="AirBank 柜面工作台"
      logo={<LogoBadge />}
      layout="mix"
      fixSiderbar
      fixedHeader
      siderWidth={216}
      location={{ pathname: location.pathname }}
      route={{ path: '/', routes: menuData } as unknown as ProLayoutProps['route']}
      menuItemRender={(item, dom) => (item.path ? <Link to={item.path}>{dom}</Link> : dom)}
      token={{
        header: {
          colorBgHeader: '#ffffff',
          heightLayoutHeader: 56,
          colorHeaderTitle: '#1F2D3D',
        },
        sider: {
          colorMenuBackground: NAVY_COLOR,
          colorTextMenuTitle: '#ffffff',
          colorTextMenu: 'rgba(255, 255, 255, 0.62)',
          colorTextMenuSecondary: 'rgba(255, 255, 255, 0.45)',
          colorTextMenuSelected: '#ffffff',
          colorTextMenuActive: '#ffffff',
          colorBgMenuItemHover: 'rgba(255, 255, 255, 0.06)',
          colorBgMenuItemSelected: BRAND_COLOR,
          colorBgMenuItemActive: 'rgba(255, 255, 255, 0.08)',
        },
        pageContainer: {
          paddingBlockPageContainerContent: 20,
          paddingInlinePageContainerContent: 24,
        },
      }}
      avatarProps={{
        icon: <UserOutlined />,
        size: 'small',
        style: { backgroundColor: BRAND_COLOR, borderRadius: 8 },
        title: (
          <span
            style={{
              display: 'inline-block',
              maxWidth: 168,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              verticalAlign: 'bottom',
            }}
          >
            {auth.realName || auth.tellerNo || '柜员'}
            {auth.tellerNo ? (
              <span style={{ fontWeight: 400, marginLeft: 6, opacity: 0.6 }}>
                {auth.tellerNo}
                {auth.branchNo ? ` / ${auth.branchNo}` : ''}
              </span>
            ) : null}
          </span>
        ),
        render: (_props, dom) => (
          <Dropdown
            menu={{
              items: [{ key: 'logout', icon: <LogoutOutlined />, label: '退出登录', onClick: doLogout }],
            }}
            placement="bottomRight"
          >
            {dom}
          </Dropdown>
        ),
      }}
      footerRender={() => (
        <div
          style={{
            textAlign: 'center',
            color: 'var(--ab-text-3, #8A97AD)',
            fontSize: 12,
            paddingBlock: 14,
          }}
        >
          AirBank 培训模拟银行 · 本系统仅用于业务培训与测试，不涉及真实资金
        </div>
      )}
    >
      <Alert
        banner
        type="warning"
        showIcon
        message={TRAINING_BANNER}
        className="ab-banner"
        style={{ margin: '-20px -24px 0' }}
      />
      <div className="ab-page" style={{ marginTop: 16 }}>
        <Outlet />
      </div>
    </ProLayout>
  );
}
