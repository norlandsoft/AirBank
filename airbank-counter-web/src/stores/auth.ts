import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { LoginVO, MenuNode } from '../api/types';

interface AuthState {
  token: string;
  user: string;
  realName: string;
  tellerNo: string;
  branchNo: string;
  roles: string[];
  perms: string[];
  menus: MenuNode[];
  setAuth: (vo: LoginVO) => void;
  clear: () => void;
}

function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => String(x)) : [];
}

/** 会话持久化到 sessionStorage：关闭浏览器即失效，贴合柜面习惯 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: '',
      user: '',
      realName: '',
      tellerNo: '',
      branchNo: '',
      roles: [],
      perms: [],
      menus: [],
      setAuth: (vo) =>
        set({
          token: vo?.token ?? '',
          user: typeof vo?.user === 'string' ? vo.user : '',
          realName: vo?.realName ?? '',
          tellerNo: vo?.tellerNo ?? '',
          branchNo: vo?.branchNo ?? '',
          roles: strArray(vo?.roles),
          perms: strArray(vo?.perms),
          menus: Array.isArray(vo?.menus) ? vo.menus : [],
        }),
      clear: () =>
        set({ token: '', user: '', realName: '', tellerNo: '', branchNo: '', roles: [], perms: [], menus: [] }),
    }),
    {
      name: 'airbank-counter-auth',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
