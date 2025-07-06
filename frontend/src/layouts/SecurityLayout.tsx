import React, {useEffect, useState} from 'react';
import {connect} from 'umi';
import Login from '@/pages/Login';
import BasicLayout from '@/layouts/BasicLayout';

const SecurityLayout: React.FC = (props: any) => {

  const {
    currentUser,
    dispatch,
    loading,
  } = props;

  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
    // 检查是否登录
    if (dispatch) {
      dispatch({
        type: 'user/fetchCurrentUser'
      });
    }
  }, []);


  // 是否可以获取当前用户信息
  const isLogin = currentUser && currentUser.id;
  if ((!isLogin && loading) || !ready) {
    return <div/>;
  }

  return isLogin ? <BasicLayout/> : <Login/>;
}

export default connect(({user, loading}) => ({
  currentUser: user.currentUser,
  loading: loading.effects['user/fetchCurrentUser']
}))(SecurityLayout);