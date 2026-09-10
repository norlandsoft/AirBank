/** ===== 用户中心（UAM） ===== */

export interface MenuNode {
  key?: string;
  name?: string;
  /** 字符串图标名，如 'DashboardOutlined' */
  icon?: string;
  path?: string;
  perm?: string | null;
  children?: MenuNode[];
}

export interface LoginVO {
  token: string;
  user?: unknown;
  realName?: string;
  tellerNo?: string;
  branchNo?: string;
  roles?: string[];
  perms?: string[];
  menus?: MenuNode[];
}

export interface CaptchaVO {
  uuid: string;
  svg: string;
}

/** ===== 柜面公共 ===== */

export interface NewCustomer {
  customerName: string;
  idType: string;
  idNo: string;
  mobile: string;
  gender?: string;
  occupation?: string;
  address?: string;
}

/** 统一交易提交报文（POST /api/counter/txns），金额单位分（字符串） */
export interface TxnPayload {
  bizType: string;
  requestNo: string;
  amount?: string;
  acctNo?: string;
  toAcct?: string;
  remark?: string;
  customerId?: string;
  customerCmd?: string;
  customer?: NewCustomer;
  termMonths?: number;
  depositNo?: string;
  productCode?: string;
  shares?: string;
  txnNo?: string;
  reason?: string;
  [k: string]: unknown;
}

export interface TxnResult {
  status?: string;
  ctNo?: string;
  txnNo?: string;
  acctNo?: string;
  cardNo?: string;
  customerId?: string;
  message?: string;
  [k: string]: unknown;
}

export interface DashboardVO {
  todayCount?: string | number;
  todayAmount?: string | number;
  cashIn?: string | number;
  cashOut?: string | number;
  boxBalance?: string | number;
  pendingReviews?: string | number;
  [k: string]: unknown;
}

export interface ShiftBox {
  beginBalance?: string | number;
  cashIn?: string | number;
  cashOut?: string | number;
  balance?: string | number;
  [k: string]: unknown;
}

export interface ShiftVO {
  status?: string;
  signInTime?: string | null;
  signOutTime?: string | null;
  tellerNo?: string;
  box?: ShiftBox;
  [k: string]: unknown;
}

export interface ReviewItem {
  id?: string | number;
  ctNo?: string;
  bizType?: string;
  amount?: string | number;
  tellerNo?: string;
  tellerName?: string;
  createdAt?: string;
  status?: string;
  summary?: string;
  [k: string]: unknown;
}

export interface CustomerVO {
  customerNo?: string;
  customerId?: string;
  name?: string;
  customerName?: string;
  idNoMask?: string;
  mobileMask?: string;
  riskLevel?: string;
  [k: string]: unknown;
}

export interface DaySettleVO {
  date?: string;
  totalCount?: string | number;
  txnCount?: string | number;
  debitSum?: string | number;
  creditSum?: string | number;
  drSum?: string | number;
  crSum?: string | number;
  balanced?: boolean;
  boxBalanced?: boolean;
  boxBegin?: string | number;
  boxEnd?: string | number;
  [k: string]: unknown;
}

export interface VoucherVO {
  ctNo?: string;
  txnNo?: string;
  bizType?: string;
  amount?: string | number;
  status?: string;
  createdAt?: string;
  content?: unknown;
  [k: string]: unknown;
}

/** ===== 理财 / 定期 ===== */

export interface WealthProduct {
  productCode?: string;
  productName?: string;
  riskLevel?: string;
  annualRate?: string | number;
  termDays?: string | number;
  termMonths?: string | number;
  minAmount?: string | number;
  status?: string;
  [k: string]: unknown;
}

export interface TimeDepositVO {
  depositNo?: string;
  acctNo?: string;
  customerId?: string;
  termMonths?: string | number;
  amount?: string | number;
  rate?: string | number;
  status?: string;
  valueDate?: string;
  maturityDate?: string;
  [k: string]: unknown;
}

/** ===== 管理端 ===== */

export interface TellerVO {
  id?: string | number;
  tellerNo?: string;
  realName?: string;
  branchNo?: string;
  roleCode?: string;
  status?: string;
  [k: string]: unknown;
}
