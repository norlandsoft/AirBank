import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Form, Input, Typography, message } from 'antd';
import { LockOutlined, SafetyOutlined, UserOutlined } from '@ant-design/icons';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getCaptcha, login } from '../api/auth';
import type { CaptchaVO } from '../api/auth';
import { useAuthStore } from '../stores/auth';
import { BRAND_COLOR } from '../theme/token';

interface LoginForm {
  loginName: string;
  password: string;
  captchaCode: string;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const authLogin = useAuthStore((s) => s.login);
  const [captcha, setCaptcha] = useState<CaptchaVO | null>(null);
  const [captchaCode, setCaptchaCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm<LoginForm>();

  const refreshCaptcha = useCallback(async () => {
    try {
      const vo = await getCaptcha();
      setCaptcha(vo);
      setCaptchaCode('');
    } catch {
      // 拦截器已提示
    }
  }, [form]);

  useEffect(() => {
    void refreshCaptcha();
  }, [refreshCaptcha]);

  const onFinish = async (values: LoginForm) => {
    if (!captcha) {
      await refreshCaptcha();
      message.warning('验证码未加载，请重试');
      return;
    }
    if (!captchaCode.trim()) {
      message.warning('请输入图形验证码');
      return;
    }
    setLoading(true);
    try {
      const vo = await login({
        loginName: values.loginName.trim(),
        password: values.password,
        userType: 'CUSTOMER',
        captchaUuid: captcha.uuid,
        captchaCode: captchaCode.trim(),
      });
      authLogin(vo.token, {
        loginName: vo.loginName,
        realName: vo.realName,
        customerId: vo.customerId ?? '',
        customerNo: vo.customerNo,
        riskLevel: vo.riskLevel,
        roles: vo.roles ?? [],
      });
      message.success(`欢迎回来，${vo.realName || vo.loginName}`);
      const redirect = searchParams.get('redirect');
      navigate(redirect && redirect.startsWith('/') ? redirect : '/home', { replace: true });
    } catch {
      await refreshCaptcha();
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
        background: `linear-gradient(135deg, ${BRAND_COLOR} 0%, #0a6b6b 55%, #084c4c 100%)`,
      }}
    >
      <div style={{ textAlign: 'center', marginTop: 64 }}>
        <Typography.Title level={3} style={{ color: '#fff', marginBottom: 4 }}>
          AirBank 网上银行
        </Typography.Title>
        <Typography.Text style={{ color: 'rgba(255,255,255,0.85)' }}>
          培训模拟环境（非真实资金）
        </Typography.Text>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 48 }}>
        <Card style={{ width: 400, boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}>
          <Typography.Title level={4} style={{ textAlign: 'center', marginBottom: 24 }}>
            客户登录
          </Typography.Title>
          <Form form={form} layout="vertical" size="large" onFinish={onFinish} requiredMark={false}>
            <Form.Item name="loginName" label="登录名" rules={[{ required: true, message: '请输入登录名' }]}>
              <Input prefix={<UserOutlined />} placeholder="登录名或手机号" autoComplete="username" />
            </Form.Item>
            <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
              <Input.Password prefix={<LockOutlined />} placeholder="密码" autoComplete="current-password" />
            </Form.Item>
            <Form.Item label="图形验证码" required>
              <div style={{ display: 'flex', gap: 8 }}>
                <Input
                  prefix={<SafetyOutlined />}
                  placeholder="验证码"
                  maxLength={6}
                  value={captchaCode}
                  onChange={(e) => setCaptchaCode(e.target.value)}
                />
                <div
                  title="点击刷新"
                  onClick={() => void refreshCaptcha()}
                  style={{
                    width: 120,
                    height: 40,
                    cursor: 'pointer',
                    borderRadius: 6,
                    overflow: 'hidden',
                    background: '#f5f5f5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                  dangerouslySetInnerHTML={{ __html: captcha?.svg ?? '<span style="font-size:12px;color:#999">加载中</span>' }}
                />
              </div>
            </Form.Item>
            <Form.Item style={{ marginBottom: 8 }}>
              <Button type="primary" htmlType="submit" block loading={loading}>
                登 录
              </Button>
            </Form.Item>
            <div style={{ textAlign: 'right' }}>
              <Link to="/register">新客户自助注册 →</Link>
            </div>
          </Form>
          <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 16, marginBottom: 0 }}>
            培训演示账号：zhangsan / lisi / wangwu，密码均为 Abc12345
          </Typography.Paragraph>
        </Card>
      </div>
      <div style={{ textAlign: 'center', padding: 16, color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
        AirBank 培训模拟银行 · 仅用于业务培训与测试
      </div>
    </div>
  );
}
