import {POST} from "@/utils/HttpRequest";

export default {
  namespace: 'user',
  state: {
    currentUser: {},
  },
  effects: {
    *login({payload, callback}, {call, put}) {
      const resp = yield call(POST, '/api/user/login', payload);
      if (callback) callback(resp);
    },
    *fetchCurrentUser({_, callback}, {put}) {
      const resp = yield POST('/api/user/current', {});
      if (callback) callback(resp);
    }
  },
  reducers: {
  },
};