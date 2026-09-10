import type { MenuNode } from '../api/types';

/** 权限判断：perm 为空视为公开（仅需登录）；perms 含 '*' 视为超管 */
export function hasPerm(perms: string[], perm?: string | null): boolean {
  if (!perm) return true;
  if (perms.includes('*')) return true;
  return perms.includes(perm);
}

/**
 * 按 perms 过滤菜单：
 * - perm 非空的项需要具备对应权限；
 * - 有 children 的组内子项过滤，过滤后为空则整组移除。
 */
export function filterMenus(menus: MenuNode[], perms: string[]): MenuNode[] {
  const out: MenuNode[] = [];
  for (const m of menus) {
    if (m.perm && !hasPerm(perms, m.perm)) continue;
    if (m.children && m.children.length > 0) {
      const kids = filterMenus(m.children, perms);
      if (kids.length === 0) continue;
      out.push({ ...m, children: kids });
    } else {
      out.push({ ...m });
    }
  }
  return out;
}

/** 内置兜底菜单（后端未下发 menus 时使用，同样按 perms 过滤） */
export const DEFAULT_MENUS: MenuNode[] = [
  { key: 'workbench', name: '工作台', icon: 'DashboardOutlined', path: '/workbench' },
  { key: 'shift', name: '签到签退', icon: 'ScheduleOutlined', path: '/shift' },
  {
    key: 'biz',
    name: '业务办理',
    icon: 'AppstoreOutlined',
    children: [
      { key: 'account-open', name: '开户', icon: 'UserAddOutlined', path: '/biz/account-open', perm: 'counter:account-open' },
      { key: 'cash-deposit', name: '现金存款', icon: 'PayCircleOutlined', path: '/biz/cash-deposit', perm: 'counter:cash' },
      { key: 'cash-withdraw', name: '现金取款', icon: 'MoneyCollectOutlined', path: '/biz/cash-withdraw', perm: 'counter:cash' },
      { key: 'transfer', name: '行内转账', icon: 'SwapOutlined', path: '/biz/transfer', perm: 'counter:transfer' },
      { key: 'time-deposit', name: '定期业务', icon: 'AccountBookOutlined', path: '/biz/time-deposit', perm: 'counter:time' },
      { key: 'wealth', name: '理财代销', icon: 'FundOutlined', path: '/biz/wealth', perm: 'counter:wealth' },
      { key: 'account-manage', name: '账户管理', icon: 'SafetyCertificateOutlined', path: '/biz/account-manage', perm: 'counter:account-admin' },
    ],
  },
  { key: 'review', name: '待复核授权', icon: 'AuditOutlined', path: '/review', perm: 'review:authorize' },
  { key: 'customer', name: '客户查询', icon: 'TeamOutlined', path: '/customer', perm: 'counter:customer-query' },
  { key: 'reverse', name: '当日冲正', icon: 'RollbackOutlined', path: '/reverse', perm: 'counter:reverse' },
  { key: 'daysettle', name: '日结签退', icon: 'ProfileOutlined', path: '/daysettle' },
  { key: 'vouchers', name: '回执查询', icon: 'FileTextOutlined', path: '/vouchers' },
  {
    key: 'admin',
    name: '系统管理',
    icon: 'SettingOutlined',
    children: [
      { key: 'tellers', name: '柜员管理', icon: 'TeamOutlined', path: '/admin/tellers', perm: 'admin:manage' },
      { key: 'params', name: '参数查看', icon: 'DatabaseOutlined', path: '/admin/params', perm: 'admin:manage' },
      { key: 'batch', name: '日终批量', icon: 'ThunderboltOutlined', path: '/admin/batch', perm: 'admin:manage' },
      { key: 'factory', name: '造数工具', icon: 'ExperimentOutlined', path: '/admin/factory', perm: 'admin:manage' },
    ],
  },
];
