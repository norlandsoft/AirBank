import { useCallback, useEffect, useState } from 'react';
import { Button, Flex, Form, Input, Tag, Typography, message } from 'antd';
import {
  InfoCircleOutlined,
  LockOutlined,
  SafetyOutlined,
  UserOutlined,
  FundOutlined,
  SwapOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getCaptcha, login } from '../api/auth';
import type { CaptchaVO } from '../api/auth';
import { useAuthStore } from '../stores/auth';
import { FONT_STACK } from '../theme/token';

interface LoginForm {
  loginName: string;
  password: string;
}

const HIGHLIGHTS = [
  { icon: <WalletOutlined />, title: '资产总览', desc: '存款 / 理财 / 收益一目了然' },
  { icon: <SwapOutlined />, title: '便捷转账', desc: '行内实时转账与电子回单' },
  { icon: <FundOutlined />, title: '理财超市', desc: '产品申购赎回与持仓管理' },
];

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
  }, []);

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
            <FundOutlined style={{ fontSize: 20, color: '#fff' }} />
          </span>
          <Typography.Text strong style={{ color: '#fff', fontSize: 17, letterSpacing: '0.02em' }}>
            AirBank
          </Typography.Text>
        </Flex>

        <div style={{ position: 'relative', zIndex: 1 }}>
          <Typography.Title level={2} style={{ color: '#fff', fontWeight: 700, marginBottom: 10 }}>
            网上银行
          </Typography.Title>
          <Typography.Paragraph style={{ color: 'rgba(255,255,255,0.72)', fontSize: 14, marginBottom: 36 }}>
            面向业务培训与测试演练的模拟网银门户
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
                    color: '#5eead4',
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
            客户登录
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 24 }}>
            欢迎回到 AirBank 网上银行
          </Typography.Paragraph>
          <Form form={form} layout="vertical" size="large" onFinish={onFinish} requiredMark={false}>
            <Form.Item name="loginName" label="登录名" rules={[{ required: true, message: '请输入登录名' }]}>
              <Input prefix={<UserOutlined style={{ color: '#8BA09C' }} />} placeholder="登录名或手机号" autoComplete="username" />
            </Form.Item>
            <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
              <Input.Password prefix={<LockOutlined style={{ color: '#8BA09C' }} />} placeholder="密码" autoComplete="current-password" />
            </Form.Item>
            <Form.Item label="图形验证码" required>
              <Flex gap={8} align="center">
                <Input
                  prefix={<SafetyOutlined style={{ color: '#8BA09C' }} />}
                  placeholder="验证码"
                  maxLength={6}
                  value={captchaCode}
                  onChange={(e) => setCaptchaCode(e.target.value)}
                />
                <div
                  title="点击刷新"
                  onClick={() => void refreshCaptcha()}
                  style={{
                    width: 116,
                    height: 40,
                    cursor: 'pointer',
                    borderRadius: 8,
                    overflow: 'hidden',
                    border: '1px solid var(--ab-border, #E4EBE9)',
                    background: '#fafbfb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'border-color .2s',
                  }}
                  dangerouslySetInnerHTML={{ __html: captcha?.svg ?? '<span style="font-size:12px;color:#999">加载中</span>' }}
                />
              </Flex>
            </Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading} size="large" style={{ fontWeight: 600 }}>
              登 录
            </Button>
            <Flex justify="flex-end" style={{ marginTop: 12 }}>
              <Link to="/register">新客户自助注册 →</Link>
            </Flex>
          </Form>
          <Flex
            gap={8}
            align="flex-start"
            style={{
              marginTop: 16,
              padding: '10px 12px',
              background: 'var(--ab-bg-layout, #F3F7F6)',
              borderRadius: 8,
            }}
          >
            <InfoCircleOutlined style={{ color: '#8BA09C', marginTop: 2 }} />
            <Typography.Text type="secondary" style={{ fontSize: 12, lineHeight: 1.7 }}>
              培训演示账号：
              <span style={{ fontFamily: FONT_STACK }}>zhangsan / lisi / wangwu</span>
              ，密码均为 Abc12345
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
