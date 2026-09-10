import axios, { AxiosError } from 'axios';
import type { AxiosRequestConfig } from 'axios';
import { message } from 'antd';
import { useAuthStore } from '../stores/auth';

export interface ApiResponse<T = unknown> {
  code: number;
  message?: string;
  data: T;
  traceId?: string;
  [k: string]: unknown;
}

/** 会话失效相关业务码（登录过期 / 未登录 / token 无效） */
export const AUTH_FAIL_CODES = [1003, 7001, 7002];

/** 统一业务错误：携带 code / traceId，页面可用 errCode(e) 取码分支处理 */
export class ApiError extends Error {
  code: number;
  traceId?: string;
  raw?: unknown;
  constructor(code: number, msg: string, traceId?: string, raw?: unknown) {
    super(msg);
    this.name = 'ApiError';
    this.code = code;
    this.traceId = traceId;
    this.raw = raw;
  }
}

const instance = axios.create({
  baseURL: '/api',
  timeout: 20000,
});

// ---- 请求拦截：注入 Bearer token（zustand persist sessionStorage）----
instance.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function redirectToLogin() {
  useAuthStore.getState().clear();
  if (window.location.pathname !== '/login') {
    window.location.replace('/login');
  }
}

// ---- 响应拦截：code!==0 统一提示；401 / 1003 / 7001 / 7002 清 store 跳登录 ----
instance.interceptors.response.use(
  (response) => {
    const body = response.data as ApiResponse | undefined;
    if (body && typeof body === 'object' && typeof body.code === 'number' && body.code !== 0) {
      if (AUTH_FAIL_CODES.includes(body.code)) {
        message.error('登录状态已失效，请重新登录');
        redirectToLogin();
      } else {
        message.error(`${body.code}: ${body.message ?? '请求失败'}`);
      }
      throw new ApiError(body.code, body.message ?? '请求失败', body.traceId, body);
    }
    return response;
  },
  (error: AxiosError<ApiResponse>) => {
    const status = error.response?.status;
    const body = error.response?.data;
    if (status === 401) {
      message.error('登录已失效，请重新登录');
      redirectToLogin();
      return Promise.reject(new ApiError(401, '未登录或会话已过期'));
    }
    if (body && typeof body === 'object' && typeof body.code === 'number' && body.code !== 0) {
      if (AUTH_FAIL_CODES.includes(body.code)) {
        message.error('登录状态已失效，请重新登录');
        redirectToLogin();
      } else {
        message.error(`${body.code}: ${body.message ?? '请求失败'}`);
      }
      return Promise.reject(new ApiError(body.code, body.message ?? '请求失败', body.traceId, body));
    }
    message.error(status ? `请求失败（HTTP ${status}）` : `网络异常：${error.message}`);
    return Promise.reject(new ApiError(status ?? -1, error.message || '网络异常', undefined, body));
  },
);

/** 提交类请求的幂等号：uuid requestNo */
export function newRequestNo(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `r${Date.now()}${Math.random().toString(16).slice(2, 10)}`;
}

export async function httpGet<T>(url: string, params?: Record<string, unknown>, config?: AxiosRequestConfig): Promise<T> {
  const res = await instance.get<ApiResponse<T>>(url, { ...config, params });
  return res.data.data;
}

export async function httpPost<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const res = await instance.post<ApiResponse<T>>(url, data, config);
  return res.data.data;
}

export async function httpPut<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const res = await instance.put<ApiResponse<T>>(url, data, config);
  return res.data.data;
}

/** 从 unknown 异常中取业务码（页面分支用，如签退 5007） */
export function errCode(e: unknown): number {
  if (e instanceof ApiError) return e.code;
  const c = (e as { code?: unknown })?.code;
  const n = Number(c);
  return Number.isFinite(n) ? n : -1;
}
