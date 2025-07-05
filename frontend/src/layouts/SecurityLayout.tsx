import React, {useEffect, useState} from 'react';
import {connect} from 'umi';
import Login from '@/pages/Login';

const SecurityLayout: React.FC = (props: any) => {

  const {
    currentUser,
    dispatch,
  } = props;

  const [isLogin, setIsLogin] = useState(false);

  useEffect(() => {
    // 检查是否登录
    dispatch({
      type: 'user/fetchCurrentUser',
      callback: resp => {
        setIsLogin(resp.success);
      }
    });

  }, []);


  return <Login />
}

export default connect(({user}) => ({
  currentUser: user.currentUser,
}))(SecurityLayout);