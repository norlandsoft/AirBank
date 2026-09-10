import { httpGet, httpPost } from './http';
import type { CaptchaVO, LoginVO } from './types';

/** 图形验证码（svg 字符串，dangerouslySetInnerHTML 渲染） */
export function getCaptcha() {
  return httpGet<CaptchaVO>('/uam/auth/captcha');
}

export function login(payload: {
  loginName: string;
  password: string;
  userType: string;
  captchaUuid: string;
  captchaCode: string;
}) {
  return httpPost<LoginVO>('/uam/auth/login', payload);
}

/** 登出（尽力而为，失败不阻断前端清会话） */
export async function logout(): Promise<void> {
  try {
    await httpPost<unknown>('/uam/auth/logout');
  } catch {
    /* 忽略登出接口异常 */
  }
}
