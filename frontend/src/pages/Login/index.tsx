import React from "react";
import {connect, history} from "umi";
import { Form, Input, Button, Card } from "antd";
import { UserOutlined, LockOutlined } from "@ant-design/icons";
import { error } from "@/components/Notification";
import "./index.less";

const Login: React.FC<any> = props => {
  const {dispatch} = props;

  const [form] = Form.useForm();

  const onFinish = (values: any) => {
    dispatch({
      type: 'user/login',
      payload: values,
      callback: resp => {
        if (resp.success) {
          history.push('/');
        } else {
          error({
            title: '登录失败',
            message: '请检查用户ID和密码',
          });
        }
      }
    });
  };

  return (
    <div className="login-container">
      <Card className="login-card" variant="borderless">
        <div className="login-title">AirBank 网上银行登录</div>
        <Form
          form={form}
          name="login"
          initialValues={{ remember: true }}
          onFinish={onFinish}
        >
          <Form.Item
            name="id"
            rules={[{ required: true, message: "请输入用户ID" }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="用户ID"
              size="large"
            />
          </Form.Item>
          <Form.Item
            name="password"
            rules={[{ required: true, message: "请输入密码" }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码"
              size="large"
            />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block size="large">
              登录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default connect(({user}) => ({
  user,
}))(Login);