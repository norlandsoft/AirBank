import { useEffect, useState } from 'react';
import {
  AuditOutlined,
  BankOutlined,
  InfoCircleOutlined,
  LockOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { Button, Flex, Form, Input, Tag, Typography, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { getCaptcha, login } from '../api/auth';
import { useAuthStore } from '../stores/auth';
import { FONT_STACK } from '../theme/token';

interface LoginForm {
  loginName: string;
  password: string;
  captchaCode: string;
}

const HIGHLIGHTS = [
  { icon: <WalletOutlined />, title: '存贷业务', desc: '开户 / 存取款 / 转账全流程' },
  { icon: <AuditOutlined />, title: '授权复核', desc: '主管复核与当日冲正闭环' },
  { icon: <BankOutlined />, title: '尾箱日结', desc: '现金尾箱管理与柜员日结' },
];

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
    <Flex style={{ minHeight: '100vh', background: '#fff' }}>
      {/* 左侧品牌面板 */}
      <Flex
        vertical
        justify="space-between"
        className="ab-login-pane"
        style={{ flex: '0 0 44%', padding: '56px 56px 40px' }}
      >
        <Flex align="center" gap={12} style={{ position: 'relative', zIndex: 1 }}>
          <span className="ab-logo-badge" style={{ width: 40, height: 40 }}>
            <BankOutlined style={{ fontSize: 21, color: '#fff' }} />
          </span>
          <Typography.Text strong style={{ color: '#fff', fontSize: 17, letterSpacing: '0.02em' }}>
            AirBank
          </Typography.Text>
        </Flex>

        <div style={{ position: 'relative', zIndex: 1 }}>
          <Typography.Title level={2} style={{ color: '#fff', fontWeight: 700, marginBottom: 10 }}>
            柜面工作台
          </Typography.Title>
          <Typography.Paragraph style={{ color: 'rgba(255,255,255,0.72)', fontSize: 14, marginBottom: 36 }}>
            面向业务培训与测试演练的模拟银行柜面系统
          </Typography.Paragraph>
          <Flex vertical gap={20}>
            {HIGHLIGHTS.map((h) => (
              <Flex key={h.title} gap={12} align="flex-start">
                <span
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 9,
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.14)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                    color: '#7db4f5',
                    flexShrink: 0,
                  }}
                >
                  {h.icon}
                </span>
                <span>
                  <Typography.Text style={{ color: '#fff', fontSize: 13.5, display: 'block' }}>
                    {h.title}
                  </Typography.Text>
                  <Typography.Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>
                    {h.desc}
                  </Typography.Text>
                </span>
              </Flex>
            ))}
          </Flex>
        </div>

        <Typography.Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, position: 'relative', zIndex: 1 }}>
          © 2026 AirBank 培训模拟银行 · 非真实资金
        </Typography.Text>
      </Flex>

      {/* 右侧登录表单 */}
      <Flex flex={1} align="center" justify="center" style={{ padding: '48px 24px', background: 'var(--ab-bg-layout)' }}>
        <div
          style={{
            width: 400,
            background: '#fff',
            borderRadius: 14,
            padding: '36px 36px 28px',
            boxShadow: 'var(--ab-shadow-card-hover)',
          }}
        >
          <Typography.Title level={4} style={{ marginBottom: 4 }}>
            柜员登录
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 24 }}>
            请使用培训工号登录工作台
          </Typography.Paragraph>
          <Form<LoginForm> form={form} layout="vertical" size="large" onFinish={onFinish} requiredMark={false}>
            <Form.Item name="loginName" label="工号" rules={[{ required: true, message: '请输入工号' }]}>
              <Input prefix={<UserOutlined style={{ color: '#8A97AD' }} />} placeholder="工号，如 990001" maxLength={32} autoFocus />
            </Form.Item>
            <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
              <Input.Password prefix={<LockOutlined style={{ color: '#8A97AD' }} />} placeholder="密码" maxLength={64} />
            </Form.Item>
            <Form.Item label="图形验证码" required style={{ marginBottom: 24 }}>
              <Flex gap={8} align="center">
                <Form.Item name="captchaCode" noStyle rules={[{ required: true, message: '请输入验证码' }]}>
                  <Input prefix={<SafetyCertificateOutlined style={{ color: '#8A97AD' }} />} placeholder="验证码" maxLength={8} />
                </Form.Item>
                <div
                  title="点击刷新验证码"
                  onClick={() => void refreshCaptcha()}
                  style={{
                    cursor: 'pointer',
                    minWidth: 108,
                    height: 40,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid var(--ab-border, #E6EAF2)',
                    borderRadius: 8,
                    padding: '0 8px',
                    background: '#fafbfd',
                    transition: 'border-color .2s',
                  }}
                  dangerouslySetInnerHTML={{ __html: captcha?.svg ?? '<span style="color:#999">加载中…</span>' }}
                />
                <Button icon={<ReloadOutlined />} onClick={() => void refreshCaptcha()} title="刷新验证码" />
              </Flex>
            </Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading} size="large" style={{ fontWeight: 600 }}>
              登 录
            </Button>
          </Form>
          <Flex
            gap={8}
            align="flex-start"
            style={{
              marginTop: 18,
              padding: '10px 12px',
              background: 'var(--ab-bg-layout, #F4F6FA)',
              borderRadius: 8,
            }}
          >
            <InfoCircleOutlined style={{ color: '#8A97AD', marginTop: 2 }} />
            <Typography.Text type="secondary" style={{ fontSize: 12, lineHeight: 1.7 }}>
              演示账号：
              <span style={{ fontFamily: FONT_STACK }}>990001</span>（柜员）/
              <span style={{ fontFamily: FONT_STACK }}> 990002</span>（主管）/
              <span style={{ fontFamily: FONT_STACK }}> 999999</span>（管理员），
              密码 Abc12345
            </Typography.Text>
          </Flex>
          <Flex justify="center" style={{ marginTop: 14 }}>
            <Tag color="warning" style={{ borderRadius: 6 }}>
              培训模拟环境 · 非真实资金
            </Tag>
          </Flex>
        </div>
      </Flex>
    </Flex>
  );
}
