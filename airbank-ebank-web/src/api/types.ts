/** 共享 VO 类型。金额字段后端 Long → 字符串序列化，统一 string（分）。 */

export type PageParams = {
  pageNum?: number;
  pageSize?: number;
};

export interface PageResult<T> {
  list: T[];
  total: number;
  pageNum: number;
  pageSize: number;
}

// ---------- 账户 / 流水 ----------

export interface AccountVO {
  acctNo: string;
  acctName?: string;
  acctType: 'DEMAND' | 'TIME' | string;
  balance: string;
  status: 'ACTIVE' | 'FROZEN' | 'CLOSED' | string;
}

export interface TxnItemVO {
  txnNo: string;
  txnType: string;
  amount: string;
  /** DEBIT 借方（红）/ CREDIT 贷方（绿） */
  direction?: 'DEBIT' | 'CREDIT' | string;
  summary?: string;
  batchDate?: string;
  status?: string;
}

// ---------- 首页 ----------

export interface HomeVO {
  depositTotal: string;
  wealthTotal: string;
  accruingIncome: string;
  accounts: AccountVO[];
  recentTxns: TxnItemVO[];
}

// ---------- 定期存单 ----------

export interface TimeDepositVO {
  depositNo: string;
  termMonths: number;
  annualRate: number;
  amount: string;
  maturityDate?: string;
  status: 'HOLDING' | 'MATURED_PAID' | 'BROKEN_EARLY' | string;
}

// ---------- 转账 / 限额 / 名册 ----------

export interface TransferLimitVO {
  singleLimit: string;
  dailyLimit: string;
  todayUsed: string;
}

export interface TransferCmd {
  requestNo: string;
  fromAcct: string;
  toAcct: string;
  toName: string;
  /** 单位：分 */
  amount: number;
  summary?: string;
  otpCode: string;
}

export interface TransferVO {
  txnNo?: string;
  requestNo?: string;
  duplicated?: boolean;
  status?: string;
}

export interface BeneficiaryVO {
  id: number | string;
  payeeName: string;
  payeeAcct: string;
  alias?: string;
}

// ---------- 理财 ----------

export type RiskLevel = 'R1' | 'R2' | 'R3';

export interface WealthProductVO {
  productCode: string;
  productName: string;
  termDays: number;
  /** 小数年化，如 0.026 */
  annualRate: number;
  riskLevel: RiskLevel | string;
  /** 以下金额单位：分 */
  minAmount: string;
  stepAmount: string;
  maxSingleAmount: string;
  raiseLimit: string;
  raisedAmount: string;
  status: 'ON_SALE' | 'OFF_SALE' | 'SOLD_OUT' | 'RUNNING' | 'SETTLING' | 'CLOSED' | string;
}

export interface WealthPositionVO {
  id: number | string;
  productCode: string;
  productName?: string;
  /** 份额（1 元 = 1 份） */
  shares: string;
  costAmount: string;
  accruingIncome: string;
  paidIncome: string;
  productStatus: string;
}

export interface WealthOrderVO {
  orderNo: string;
  productCode: string;
  productName?: string;
  orderType: 'PURCHASE' | 'REDEEM' | string;
  amount: string;
  status: string;
  createdAt?: string;
}

// ---------- 回单 / 消息 / 客户 ----------

export interface ReceiptVO {
  receiptNo: string;
  bizType: 'TRANSFER' | 'SUBSCRIBE' | 'REDEEM' | string;
  bizNo?: string;
  amount?: string;
  content?: unknown;
  createdAt?: string;
}

export type MsgType = 'OTP' | 'TRADE' | 'BATCH';

export interface MessageVO {
  id: number | string;
  msgType: MsgType | string;
  title: string;
  content?: string;
  isRead: boolean;
  createdAt?: string;
}

export interface ProfileVO {
  customerId: string;
  customerNo?: string;
  loginName?: string;
  realName?: string;
  mobile?: string;
  riskLevel?: string;
}

// ---------- 小额信贷 ----------

export interface LoanProductVO {
  productCode: string;
  productName: string;
  description?: string;
  /** 单位：分 */
  minAmount: string;
  maxAmount: string;
  /** 可选期限（月），逗号分隔，如 "3,6,12,24,36" */
  termOptions: string;
  /** 基准年化利率（小数，如 0.072） */
  annualRate: number;
  repayMethod: string;
  minScore: number;
  status: string;
}

export interface LoanApplicationVO {
  applyNo: string;
  productCode: string;
  productName?: string;
  amount: string;
  termMonths: number;
  purpose?: string;
  acctNo: string;
  status: string;
  idCheckResult?: string;
  creditScore?: number;
  approveAmount?: string;
  approveRate?: number;
  rejectReason?: string;
  loanNo?: string;
  createdAt?: string;
}

export interface LoanAccountVO {
  loanNo: string;
  applyNo?: string;
  productCode: string;
  productName?: string;
  principal: string;
  annualRate: number;
  termMonths: number;
  repayMethod: string;
  acctNo: string;
  disburseDate?: string;
  remainPrincipal: string;
  paidPrincipal: string;
  paidInterest: string;
  status: string;
  nextDueDate?: string;
  nextDueAmount?: string;
  createdAt?: string;
}

export interface LoanScheduleVO {
  periodNo: number;
  dueDate: string;
  principal: string;
  interest: string;
  total: string;
  status: string;
  paidAt?: string;
}

export interface LoanRepaymentVO {
  repayNo: string;
  loanNo: string;
  repayMode: string;
  periodNo?: number;
  amount: string;
  principalPart: string;
  interestPart: string;
  status: string;
  failReason?: string;
  createdAt?: string;
}

export interface LoanDetailVO {
  account: LoanAccountVO;
  schedules: LoanScheduleVO[];
  repayments: LoanRepaymentVO[];
}
