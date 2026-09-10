import { useMemo } from 'react';
import { Alert, Dropdown } from 'antd';
import { BankOutlined, LogoutOutlined, UserOutlined } from '@ant-design/icons';
import type { MenuDataItem, ProLayoutProps } from '@ant-design/pro-components';
import { ProLayout } from '@ant-design/pro-components';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { logout } from '../api/auth';
import { useAuthStore } from '../stores/auth';
import { TRAINING_BANNER } from '../theme/token';
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

/** 柜面工作台布局：ProLayout 侧边菜单 + 顶栏 + 培训环境横幅 */
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
      logo={<BankOutlined style={{ fontSize: 26, color: '#fff' }} />}
      layout="mix"
      fixSiderbar
      fixedHeader
      siderWidth={208}
      location={{ pathname: location.pathname }}
      route={{ path: '/', routes: menuData } as unknown as ProLayoutProps['route']}
      menuItemRender={(item, dom) => (item.path ? <Link to={item.path}>{dom}</Link> : dom)}
      avatarProps={{
        icon: <UserOutlined />,
        size: 'small',
        style: { backgroundColor: '#1B4D92' },
        title: (
          <span>
            {auth.realName || auth.tellerNo || '柜员'}
            {auth.tellerNo ? (
              <span style={{ fontWeight: 400, marginLeft: 6, opacity: 0.75 }}>
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
          >
            {dom}
          </Dropdown>
        ),
      }}
    >
      <Alert banner type="warning" showIcon message={TRAINING_BANNER} />
      <div style={{ padding: 16 }}>
        <Outlet />
      </div>
    </ProLayout>
  );
}
