import { useState } from 'react';
import { Button, Card, Form, Input, Result, Space, Steps, Typography, message } from 'antd';
import { EyeOutlined, SafetyOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { registerOtpLatest } from '../api/ebank';
import { register, registerCheck } from '../api/ebank';

interface IdentityForm {
  customerNo: string;
  mobile: string;
}

interface RegisterForm {
  otpCode: string;
  loginName: string;
  password: string;
  confirmPassword: string;
}

const STEPS = ['身份校验', '设置登录信息', '完成'];

export default function RegisterPage() {
  const [current, setCurrent] = useState(0);
  const [identity, setIdentity] = useState<IdentityForm | null>(null);
  const [loading, setLoading] = useState(false);
  const [latestOtpCode, setLatestOtpCode] = useState<string | null>(null);
  const [loginName, setLoginName] = useState('');
  const [form] = Form.useForm<RegisterForm>();

  // 步骤一：客户号 + 预留手机 → 校验并发送 OTP
  const handleCheck = async (values: IdentityForm) => {
    setLoading(true);
    try {
      await registerCheck(values.customerNo.trim(), values.mobile.trim());
      setIdentity(values);
      setCurrent(1);
      message.success('身份校验通过，验证码已发送至预留手机');
    } catch {
      // 拦截器已提示
    } finally {
      setLoading(false);
    }
  };

  // 步骤二：查看验证码（培训特性，未登录态经 ebank 后端转发）
  const handleViewOtp = async () => {
    try {
      const code = await registerOtpLatest(identity?.customerNo ?? '');
      setLatestOtpCode(code);
    } catch {
      // 拦截器已提示
    }
  };

  // 步骤二提交：OTP + 登录名/密码 → 完成注册
  const handleRegister = async (values: RegisterForm) => {
    if (!identity) return;
    setLoading(true);
    try {
      await register({
        customerNo: identity.customerNo.trim(),
        mobile: identity.mobile.trim(),
        loginName: values.loginName.trim(),
        password: values.password,
        otpCode: values.otpCode.trim(),
      });
      setLoginName(values.loginName.trim());
      setCurrent(2);
    } catch {
      // 拦截器已提示
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(165deg, #0f766e 0%, #0d9488 48%, #14b8a6 100%)',
      }}
    >
      <div style={{ textAlign: 'center', marginTop: 48 }}>
        <Typography.Title level={3} style={{ color: '#fff', marginBottom: 4 }}>
          AirBank 网上银行 · 自助注册
        </Typography.Title>
        <Typography.Text style={{ color: 'rgba(255,255,255,0.85)' }}>
          培训模拟环境（非真实资金）· 仅已开户客户可注册
        </Typography.Text>
      </div>
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', paddingTop: 32, paddingBottom: 48 }}>
        <Card style={{ width: 520, height: 'fit-content', borderRadius: 14, boxShadow: '0 12px 40px rgba(6, 41, 37, 0.28)' }}>
          <Steps current={current} items={STEPS.map((t) => ({ title: t }))} style={{ marginBottom: 32 }} />

          {current === 0 && (
            <Form<IdentityForm> layout="vertical" onFinish={handleCheck} requiredMark={false}>
              <Form.Item
                name="customerNo"
                label="客户号"
                extra="开户回执上的客户号（10 开头）"
                rules={[{ required: true, message: '请输入客户号' }]}
              >
                <Input placeholder="请输入银行预留客户号" />
              </Form.Item>
              <Form.Item
                name="mobile"
                label="预留手机号"
                rules={[
                  { required: true, message: '请输入预留手机号' },
                  { pattern: /^1\d{10}$/, message: '手机号格式不正确' },
                ]}
              >
                <Input placeholder="请输入开户预留手机号" maxLength={11} />
              </Form.Item>
              <Button type="primary" htmlType="submit" block loading={loading}>
                校验身份并发送验证码
              </Button>
            </Form>
          )}

          {current === 1 && (
            <Form<RegisterForm>
              form={form}
              layout="vertical"
              onFinish={handleRegister}
              requiredMark={false}
            >
              <Form.Item
                name="otpCode"
                label="短信验证码"
                extra={`已发送至 ${identity?.mobile?.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') ?? '预留手机'}`}
                rules={[{ required: true, message: '请输入短信验证码' }]}
              >
                <Input
                  addonAfter={
                    <Button type="link" size="small" icon={<EyeOutlined />} style={{ padding: 0 }} onClick={() => void handleViewOtp()}>
                      查看验证码
                    </Button>
                  }
                  placeholder="6 位验证码"
                  maxLength={6}
                />
              </Form.Item>
              {latestOtpCode && (
                <Typography.Paragraph type="success" style={{ marginTop: -12 }}>
                  <SafetyOutlined /> 模拟短信验证码：<Typography.Text strong copyable>{latestOtpCode}</Typography.Text>
                </Typography.Paragraph>
              )}
              <Form.Item
                name="loginName"
                label="登录名"
                extra="4~20 位字母/数字，注册后用于登录网银"
                rules={[
                  { required: true, message: '请设置登录名' },
                  { pattern: /^[a-zA-Z0-9]{4,20}$/, message: '4~20 位字母或数字' },
                ]}
              >
                <Input placeholder="请设置登录名" />
              </Form.Item>
              <Form.Item
                name="password"
                label="登录密码"
                extra="8~20 位，须同时包含字母和数字"
                rules={[
                  { required: true, message: '请设置密码' },
                  { min: 8, message: '至少 8 位' },
                  { max: 20, message: '最多 20 位' },
                  {
                    validator: (_, value: string) =>
                      !value || /[a-zA-Z]/.test(value) && /\d/.test(value)
                        ? Promise.resolve()
                        : Promise.reject(new Error('须同时包含字母和数字')),
                  },
                ]}
              >
                <Input.Password placeholder="请设置登录密码" />
              </Form.Item>
              <Form.Item
                name="confirmPassword"
                label="确认密码"
                dependencies={['password']}
                rules={[
                  { required: true, message: '请再次输入密码' },
                  ({ getFieldValue }) => ({
                    validator: (_, value: string) =>
                      !value || value === getFieldValue('password')
                        ? Promise.resolve()
                        : Promise.reject(new Error('两次输入的密码不一致')),
                  }),
                ]}
              >
                <Input.Password placeholder="请再次输入密码" />
              </Form.Item>
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <Button onClick={() => setCurrent(0)}>上一步</Button>
                <Button type="primary" htmlType="submit" loading={loading}>
                  完成注册
                </Button>
              </Space>
            </Form>
          )}

          {current === 2 && (
            <Result
              status="success"
              title="注册成功"
              subTitle={
                <>
                  网银账号 <Typography.Text strong copyable>{loginName}</Typography.Text> 已开通
                </>
              }
              extra={[
                <Link key="login" to="/login">
                  <Button type="primary" size="large">
                    去登录
                  </Button>
                </Link>,
              ]}
            />
          )}
        </Card>
      </div>
    </div>
  );
}
