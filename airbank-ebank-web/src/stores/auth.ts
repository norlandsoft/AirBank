import { create } from 'zustand';

const STORAGE_KEY = 'airbank-ebank-auth';

export interface LoginUser {
  loginName: string;
  realName: string;
  /** 后端 Long → 字符串序列化 */
  customerId: string;
  customerNo?: string;
  riskLevel?: string;
  roles: string[];
}

interface AuthState {
  token: string | null;
  user: LoginUser | null;
  login: (token: string, user: LoginUser) => void;
  setRiskLevel: (level: string) => void;
  clear: () => void;
}

function loadPersisted(): { token: string | null; user: LoginUser | null } {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { token?: string; user?: LoginUser };
      return { token: parsed.token ?? null, user: parsed.user ?? null };
    }
  } catch {
    // 忽略损坏的会话数据
  }
  return { token: null, user: null };
}

/** 登录态持久化 sessionStorage：关闭浏览器即失效（docs/design/10 §6） */
export const useAuthStore = create<AuthState>((set) => ({
  ...loadPersisted(),
  login: (token, user) => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user }));
    set({ token, user });
  },
  setRiskLevel: (level) => {
    set((s) => {
      const user = s.user ? { ...s.user, riskLevel: level } : s.user;
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ token: s.token, user }));
      return { user };
    });
  },
  clear: () => {
    sessionStorage.removeItem(STORAGE_KEY);
    set({ token: null, user: null });
  },
}));
