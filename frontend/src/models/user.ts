import {POST} from "@/utils/HttpRequest";

export default {
  namespace: 'user',
  state: {
    user: null,
  },
  effects: {
    *login(action, {call, put}) {
      const resp = yield call(POST, '/api/user/login', action.payload);
      console.log(resp);
    },
  },
  reducers: {
  },
};