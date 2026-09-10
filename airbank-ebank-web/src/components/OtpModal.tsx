import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Input, Modal, Space, Typography, message } from 'antd';
import { EyeOutlined, SendOutlined } from '@ant-design/icons';
import { latestOtp, sendOtp } from '../api/auth';

interface OtpModalProps {
  open: boolean;
  /** OTP 场景：TRANSFER / WEALTH / LIMIT ... */
  scene: string;
  title?: string;
  description?: React.ReactNode;
  onCancel: () => void;
  /** 提交校验：resolve 关闭弹窗，reject 保持打开（错误提示由拦截器统一弹出） */
  onVerify: (otpCode: string) => Promise<void>;
}

const COUNTDOWN_SECONDS = 60;

/**
 * OTP 确认弹窗：打开自动发送（60s 倒计时重发）+ 培训特性"查看验证码"。
 */
export default function OtpModal({ open, scene, title = '短信验证码确认', description, onCancel, onVerify }: OtpModalProps) {
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [latestCode, setLatestCode] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const doSend = async () => {
    setSending(true);
    try {
      await sendOtp(scene);
      message.success('验证码已发送（模拟短信）');
      setLatestCode(null);
      setCountdown(COUNTDOWN_SECONDS);
      stopTimer();
      timerRef.current = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            stopTimer();
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    } catch {
      // 错误提示由拦截器统一处理
    } finally {
      setSending(false);
    }
  };

  const showLatest = async () => {
    try {
      const otp = await latestOtp(scene);
      setLatestCode(otp);
    } catch {
      // 错误提示由拦截器统一处理
    }
  };

  useEffect(() => {
    if (open) {
      setCode('');
      setLatestCode(null);
      setCountdown(0);
      void doSend();
    }
    return stopTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, scene]);

  const handleOk = async () => {
    if (!code.trim()) {
      message.warning('请输入短信验证码');
      return;
    }
    setSubmitting(true);
    try {
      await onVerify(code.trim());
      stopTimer();
      onCancel(); // 成功后由父组件负责刷新数据，此处仅关闭
    } catch {
      // 失败保持弹窗打开，可修正后重试
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title={title}
      onCancel={() => {
        stopTimer();
        onCancel();
      }}
      onOk={handleOk}
      okText="确认提交"
      okButtonProps={{ loading: submitting }}
      destroyOnClose
      width={440}
    >
      {description ? <Typography.Paragraph type="secondary">{description}</Typography.Paragraph> : null}
      <Space.Compact style={{ width: '100%', marginTop: description ? 0 : 8 }}>
        <Input
          placeholder="请输入 6 位短信验证码"
          value={code}
          maxLength={6}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          onPressEnter={handleOk}
        />
        <Button
          icon={<SendOutlined />}
          onClick={doSend}
          loading={sending}
          disabled={countdown > 0}
          style={{ width: 128 }}
        >
          {countdown > 0 ? `${countdown}s 后重发` : '重新发送'}
        </Button>
      </Space.Compact>
      <Button
        type="link"
        size="small"
        icon={<EyeOutlined />}
        onClick={showLatest}
        style={{ paddingLeft: 0, marginTop: 8 }}
      >
        查看验证码（培训环境）
      </Button>
      {latestCode ? (
        <Alert
          style={{ marginTop: 8 }}
          type="success"
          showIcon
          message={`模拟短信验证码：${latestCode}`}
        />
      ) : null}
    </Modal>
  );
}
