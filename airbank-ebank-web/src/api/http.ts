import axios, { AxiosError } from 'axios';
import type { AxiosInstance, AxiosRequestConfig } from 'axios';
import { message } from 'antd';
import { useAuthStore } from '../stores/auth';

/** 统一响应结构：code=0 成功（docs/design/07 §4） */
export interface ApiResult<T> {
  code: number;
  message: string;
  data: T;
  traceId?: string;
  timestamp?: number;
}

/** 业务错误（code !== 0） */
export class ApiError extends Error {
  readonly code: number;
  readonly traceId?: string;

  constructor(code: number, msg: string, traceId?: string) {
    super(msg);
    this.code = code;
    this.traceId = traceId;
  }
}

/** 未认证/会话失效错误码：401 HTTP、1003 UAM、7001/7002 网关 */
const AUTH_FAIL_CODES = [401, 1003, 7001, 7002];

function gotoLogin(): void {
  useAuthStore.getState().clear();
  if (window.location.pathname !== '/login') {
    const redirect = encodeURIComponent(
      window.location.pathname + window.location.search,
    );
    message.warning('登录已失效，请重新登录');
    window.location.replace(`/login?redirect=${redirect}`);
  }
}

const http: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 15000,
});

// 请求拦截：注入 Authorization
http.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截：code !== 0 → message.error；401/1003/7001/7002 → 跳登录
http.interceptors.response.use(
  (resp) => {
    const body = resp.data as ApiResult<unknown>;
    if (body && typeof body === 'object' && 'code' in body) {
      if (body.code === 0) return resp;
      const trace = body.traceId ? `（traceId: ${body.traceId}）` : '';
      if (AUTH_FAIL_CODES.includes(body.code)) {
        gotoLogin();
        return Promise.reject(new ApiError(body.code, body.message, body.traceId));
      }
      message.error(`${body.message}${trace}`);
      return Promise.reject(new ApiError(body.code, body.message, body.traceId));
    }
    return resp;
  },
  (error: AxiosError<ApiResult<unknown>>) => {
    const status = error.response?.status;
    const body = error.response?.data;
    const trace = body?.traceId ? `（traceId: ${body.traceId}）` : '';
    const msg = body?.message || error.message || '网络异常，请稍后重试';
    if (status && AUTH_FAIL_CODES.includes(status)) {
      gotoLogin();
      return Promise.reject(new ApiError(status, msg, body?.traceId));
    }
    message.error(`${msg}${trace}`);
    return Promise.reject(
      new ApiError(status ?? -1, msg, body?.traceId),
    );
  },
);

async function request<T>(config: AxiosRequestConfig): Promise<T> {
  const resp = await http.request<ApiResult<T>>(config);
  return resp.data.data;
}

export function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  return request<T>({ method: 'GET', url, params });
}

export function post<T>(url: string, data?: unknown): Promise<T> {
  return request<T>({ method: 'POST', url, data });
}

export function put<T>(url: string, data?: unknown): Promise<T> {
  return request<T>({ method: 'PUT', url, data });
}

export function del<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  return request<T>({ method: 'DELETE', url, params });
}

/** 幂等号：uuid v4（docs/design/07 §5 前端 requestNo 前置生成） */
export function newRequestNo(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}
