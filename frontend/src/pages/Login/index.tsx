import React from "react";
import {connect} from "umi";
import { Form, Input, Button, Card } from "antd";
import { UserOutlined, LockOutlined } from "@ant-design/icons";
import "./index.less";

const Login: React.FC<any> = props => {
  const {dispatch} = props;

  const [form] = Form.useForm();

  const onFinish = (values: any) => {
    dispatch({
      type: 'user/login',
      payload: values,
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
            name="userId"
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