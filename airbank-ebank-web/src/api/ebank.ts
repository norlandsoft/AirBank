import { del, get, post, put } from './http';
import type {
  AccountVO,
  BeneficiaryVO,
  HomeVO,
  MessageVO,
  PageResult,
  ProfileVO,
  ReceiptVO,
  TimeDepositVO,
  TransferCmd,
  TransferLimitVO,
  TransferVO,
  TxnItemVO,
} from './types';

// ---------- 自助注册 ----------

/** POST /api/ebank/register/otp-latest：培训环境特性——查看注册验证码（未登录态，仅 REGISTER 场景） */
export async function registerOtpLatest(customerNo: string): Promise<string | null> {
  const r = await post<{ data?: string | null }>('/ebank/register/otp-latest', { customerNo });
  return r.data ?? null;
}

/** POST /api/ebank/register/check：身份校验（客户号+预留手机），通过后发送 REGISTER OTP */
export function registerCheck(customerNo: string, mobile: string): Promise<void> {
  return post<void>('/ebank/register/check', { customerNo, mobile });
}

export interface RegisterCmd {
  customerNo: string;
  mobile: string;
  loginName: string;
  password: string;
  otpCode: string;
}

/** POST /api/ebank/register：完成注册（绑定登录名/密码） */
export function register(cmd: RegisterCmd): Promise<void> {
  return post<void>('/ebank/register', cmd);
}

// ---------- 资产总览 ----------

/** GET /api/ebank/home：存款+理财聚合总览 */
export function getHome(): Promise<HomeVO> {
  return get<HomeVO>('/ebank/home');
}

// ---------- 账户 / 存单 / 明细 ----------

/** GET /api/ebank/accounts */
export function listAccounts(): Promise<AccountVO[]> {
  return get<AccountVO[]>('/ebank/accounts');
}

/** GET /api/ebank/time-deposits */
export function listTimeDeposits(): Promise<TimeDepositVO[]> {
  return get<TimeDepositVO[]>('/ebank/time-deposits');
}

/** GET /api/ebank/accounts/{acctNo}/details：交易明细分页 */
export function listAccountDetails(
  acctNo: string,
  pageNum: number,
  pageSize: number,
): Promise<PageResult<TxnItemVO>> {
  return get<PageResult<TxnItemVO>>(
    `/ebank/accounts/${encodeURIComponent(acctNo)}/details`,
    { pageNum, pageSize },
  );
}

// ---------- 转账 / 限额 / 收款人名册 ----------

/** GET /api/ebank/transfers/limit：当前限额与今日已用 */
export function getTransferLimit(): Promise<TransferLimitVO> {
  return get<TransferLimitVO>('/ebank/transfers/limit');
}

export interface UpdateLimitCmd {
  singleLimit: number;
  dailyLimit: number;
  /** 上调时必填（scene=LIMIT） */
  otpCode?: string;
}

/** PUT /api/ebank/transfers/limit：下调免 OTP，上调需 OTP */
export function updateTransferLimit(cmd: UpdateLimitCmd): Promise<void> {
  return put<void>('/ebank/transfers/limit', cmd);
}

/** POST /api/ebank/transfers：行内转账（OTP 后置确认，requestNo 幂等） */
export function submitTransfer(cmd: TransferCmd): Promise<TransferVO> {
  return post<TransferVO>('/ebank/transfers', cmd);
}

/** GET /api/ebank/beneficiaries */
export function listBeneficiaries(): Promise<BeneficiaryVO[]> {
  return get<BeneficiaryVO[]>('/ebank/beneficiaries');
}

export interface BeneficiaryCmd {
  payeeName: string;
  payeeAcct: string;
  alias?: string;
}

/** POST /api/ebank/beneficiaries */
export function addBeneficiary(cmd: BeneficiaryCmd): Promise<void> {
  return post<void>('/ebank/beneficiaries', cmd);
}

/** DELETE /api/ebank/beneficiaries/{id} */
export function deleteBeneficiary(id: number | string): Promise<void> {
  return del<void>(`/ebank/beneficiaries/${encodeURIComponent(String(id))}`);
}

// ---------- 电子回单 / 消息中心 / 客户资料 ----------

/** GET /api/ebank/receipts */
export function listReceipts(
  pageNum: number,
  pageSize: number,
): Promise<PageResult<ReceiptVO>> {
  return get<PageResult<ReceiptVO>>('/ebank/receipts', { pageNum, pageSize });
}

/** GET /api/ebank/messages */
export function listMessages(
  pageNum: number,
  pageSize: number,
): Promise<PageResult<MessageVO>> {
  return get<PageResult<MessageVO>>('/ebank/messages', { pageNum, pageSize });
}

/** PUT /api/ebank/messages/{id}/read */
export function markMessageRead(id: number | string): Promise<void> {
  return put<void>(`/ebank/messages/${encodeURIComponent(String(id))}/read`);
}

/** GET /api/ebank/profile：当前客户资料 */
export function getProfile(): Promise<ProfileVO> {
  return get<ProfileVO>('/ebank/profile');
}
