import { get, post, put } from './http';

/** 登录结果：token + 用户信息 + 角色（UAM LoginVO） */
export interface LoginVO {
  token: string;
  loginName: string;
  userType?: string;
  realName: string;
  /** Long → 字符串 */
  customerId?: string;
  customerNo?: string;
  riskLevel?: string;
  roles?: string[];
  perms?: string[];
}

export interface CaptchaVO {
  uuid: string;
  svg: string;
}

export interface LoginCmd {
  loginName: string;
  password: string;
  userType: 'CUSTOMER';
  captchaUuid: string;
  captchaCode: string;
}

/** GET /api/uam/auth/captcha：图形验证码（svg，dangerouslySetInnerHTML 渲染） */
export function getCaptcha(): Promise<CaptchaVO> {
  return get<CaptchaVO>('/uam/auth/captcha');
}

/** POST /api/uam/auth/login：网银客户登录（userType=CUSTOMER） */
export function login(cmd: LoginCmd): Promise<LoginVO> {
  return post<LoginVO>('/uam/auth/login', cmd);
}

/** POST /api/uam/auth/logout */
export function logout(): Promise<void> {
  return post<void>('/uam/auth/logout');
}

/** POST /api/uam/otp/send：场景化发送短信验证码（模拟） */
export function sendOtp(scene: string): Promise<void> {
  return post<void>('/uam/otp/send', { scene });
}

/** POST /api/uam/otp/latest：培训环境特性——查看本人最新验证码 */
export function latestOtp(scene: string): Promise<string> {
  return post<string>('/uam/otp/latest', { scene });
}

export interface RiskSubmitCmd {
  customerId: string;
  /** 5 题，每题 1~5 分 */
  scores: number[];
}

/** POST /api/uam/risk-assessments：提交风险测评，返回等级 C1~C5 */
export function submitRiskAssessment(cmd: RiskSubmitCmd): Promise<string> {
  return post<string>('/uam/risk-assessments', cmd);
}

export interface RiskLevelVO {
  level?: string;
  score?: number;
}

/** GET /api/uam/risk-assessments/latest */
export function latestRiskAssessment(customerId: string): Promise<RiskLevelVO> {
  return get<RiskLevelVO>('/uam/risk-assessments/latest', { customerId });
}

/** PUT /api/uam/profile/password：修改登录密码 */
export function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  return put<void>('/uam/profile/password', { oldPassword, newPassword });
}
