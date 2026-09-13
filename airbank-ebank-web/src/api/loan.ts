import { get, post } from './http';
import type {
  LoanAccountVO,
  LoanApplicationVO,
  LoanDetailVO,
  LoanProductVO,
  LoanRepaymentVO,
} from './types';

/** GET /api/ebank/loan/products：在售贷款产品 */
export function listLoanProducts(): Promise<LoanProductVO[]> {
  return get<LoanProductVO[]>('/ebank/loan/products');
}

export interface LoanApplyCmd {
  requestNo: string;
  productCode: string;
  /** 单位：元（渠道侧转分） */
  amount: number;
  termMonths: number;
  purpose?: string;
  otpCode: string;
}

/** POST /api/ebank/loan/apply：贷款申请（联网核查 → 征信 → 审批 → 放款 同步完成） */
export function applyLoan(cmd: LoanApplyCmd): Promise<LoanApplicationVO> {
  return post<LoanApplicationVO>('/ebank/loan/apply', cmd);
}

/** GET /api/ebank/loan/applications：我的申请记录 */
export function listMyApplications(): Promise<LoanApplicationVO[]> {
  return get<LoanApplicationVO[]>('/ebank/loan/applications');
}

/** GET /api/ebank/loan/loans：我的借据 */
export function listMyLoans(): Promise<LoanAccountVO[]> {
  return get<LoanAccountVO[]>('/ebank/loan/loans');
}

/** GET /api/ebank/loan/loans/{loanNo}：借据详情（台账 + 还款计划 + 还款记录） */
export function getLoanDetail(loanNo: string): Promise<LoanDetailVO> {
  return get<LoanDetailVO>(`/ebank/loan/loans/${loanNo}`);
}

export interface LoanRepayCmd {
  requestNo: string;
  loanNo: string;
  /** INSTALLMENT 还最早一期 / SETTLE 提前结清 */
  repayMode: string;
  otpCode: string;
}

/** POST /api/ebank/loan/repay：还款（金额由信贷系统按计划权威计算） */
export function repayLoan(cmd: LoanRepayCmd): Promise<LoanRepaymentVO> {
  return post<LoanRepaymentVO>('/ebank/loan/repay', cmd);
}
