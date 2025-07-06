import {POST} from "@/utils/HttpRequest";
import {SHA} from "@/utils/CryptoUtils";
import {error} from "@/components/Notification";

export default {
  namespace: 'user',
  state: {
    currentUser: {},
  },
  effects: {
    *login({payload}, {put}) {
      const {password} = payload;
      const newPassword = SHA(password);
      const resp = yield POST('/api/user/login', {...payload, password: newPassword});
      if (resp.success) {
        if (resp.data.loginStatus === 'logged_in') {
          // 登录成功，保存id和token
          sessionStorage.setItem('air-bank-user-id', resp.data.id);
          sessionStorage.setItem('air-bank-user-token', resp.data.token);

          // 刷新页面
          history.go(0);
        }
      } else {
        error({
          title: '登录失败',
          message: resp.message,
        });
      }
    },
    *fetchCurrentUser(_, {put}) {
      const userId = sessionStorage.getItem("air-bank-user-id");
      const token = sessionStorage.getItem("air-bank-user-token");
      
      if (!userId || !token) {
        return;
      }

      const resp = yield POST('/api/user/current', {});
      if (resp.success) {
        yield put({
          type: "saveCurrentUser",
          payload: resp.data,
        });
      } else {
        sessionStorage.removeItem("air-bank-user-id");
        sessionStorage.removeItem("air-bank-user-token");
      }
    }
  },
  reducers: {
    saveCurrentUser(state: any, {payload}: any) {
      return {
        ...state,
        currentUser: payload,
      };
    },
  },
};