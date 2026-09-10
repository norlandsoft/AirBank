import { useEffect, useState } from 'react';
import { BankOutlined, LockOutlined, ReloadOutlined, SafetyCertificateOutlined, UserOutlined } from '@ant-design/icons';
import { Button, Card, Flex, Form, Input, message, Tag, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { getCaptcha, login } from '../api/auth';
import { useAuthStore } from '../stores/auth';
import { BRAND_COLOR } from '../theme/token';

interface LoginForm {
  loginName: string;
  password: string;
  captchaCode: string;
}

/** 柜面登录：工号 + 密码 + 图形验证码（对接 /api/uam/auth） */
export default function Login() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [form] = Form.useForm<LoginForm>();
  const [captcha, setCaptcha] = useState<{ uuid: string; svg: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const refreshCaptcha = async () => {
    try {
      setCaptcha(await getCaptcha());
    } catch {
      /* 拦截器已提示 */
    }
    form.setFieldValue('captchaCode', '');
  };

  useEffect(() => {
    void refreshCaptcha();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onFinish = async (values: LoginForm) => {
    if (!captcha) {
      message.warning('验证码未加载，请点击刷新');
      return;
    }
    setLoading(true);
    try {
      const vo = await login({
        loginName: values.loginName.trim(),
        password: values.password,
        userType: 'TELLER',
        captchaUuid: captcha.uuid,
        captchaCode: values.captchaCode.trim(),
      });
      setAuth(vo);
      message.success(`欢迎使用，${vo.realName || values.loginName}`);
      navigate('/workbench', { replace: true });
    } catch {
      await refreshCaptcha();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Flex align="center" justify="center" style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #10365f 0%, #1B4D92 55%, #2c6cb0 100%)' }}>
      <Card style={{ width: 420, boxShadow: '0 8px 30px rgba(0,0,0,0.25)' }}>
        <Flex vertical gap={4} style={{ textAlign: 'center', marginBottom: 20 }}>
          <BankOutlined style={{ fontSize: 40, color: BRAND_COLOR }} />
          <Typography.Title level={3} style={{ margin: 0 }}>
            AirBank 柜面工作台
          </Typography.Title>
          <Tag color="warning" style={{ alignSelf: 'center' }}>
            培训模拟环境 · 非真实资金
          </Tag>
        </Flex>
        <Form<LoginForm> form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
          <Form.Item name="loginName" label="工号" rules={[{ required: true, message: '请输入工号' }]}>
            <Input prefix={<UserOutlined />} placeholder="工号，如 990001" maxLength={32} autoFocus />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" maxLength={64} />
          </Form.Item>
          <Form.Item label="图形验证码" required style={{ marginBottom: 24 }}>
            <Flex gap={8} align="center">
              <Form.Item name="captchaCode" noStyle rules={[{ required: true, message: '请输入验证码' }]}>
                <Input prefix={<SafetyCertificateOutlined />} placeholder="验证码" maxLength={8} />
              </Form.Item>
              <div
                title="点击刷新验证码"
                onClick={() => void refreshCaptcha()}
                style={{ cursor: 'pointer', minWidth: 110, textAlign: 'center', border: '1px solid #eee', borderRadius: 6, padding: '2px 6px', background: '#fff' }}
                dangerouslySetInnerHTML={{ __html: captcha?.svg ?? '<span style="color:#999">加载中…</span>' }}
              />
              <Button icon={<ReloadOutlined />} onClick={() => void refreshCaptcha()} />
            </Flex>
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading} size="large">
            登 录
          </Button>
        </Form>
        <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 16, marginBottom: 0, textAlign: 'center' }}>
          演示账号：990001（柜员）/ 990002（主管）/ 999999（管理员），密码 Abc12345
        </Typography.Paragraph>
      </Card>
    </Flex>
  );
}
