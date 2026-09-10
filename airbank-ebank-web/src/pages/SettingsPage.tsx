import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Space,
  Tag,
  Typography,
  message,
} from 'antd';
import { changePassword, latestRiskAssessment } from '../api/auth';
import { getProfile, getTransferLimit, updateTransferLimit } from '../api/ebank';
import type { ProfileVO, TransferLimitVO } from '../api/types';
import OtpModal from '../components/OtpModal';
import { maskMobile } from '../utils/mask';
import { fenToYuan, yuanToFen } from '../utils/money';

interface LimitForm {
  singleLimit: number;
  dailyLimit: number;
}

interface PasswordForm {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const RISK_TAG_COLOR: Record<string, string> = {
  C1: 'green',
  C2: 'cyan',
  C3: 'blue',
  C4: 'orange',
  C5: 'red',
};

export default function SettingsPage() {
  const [profile, setProfile] = useState<ProfileVO | null>(null);
  const [limit, setLimit] = useState<TransferLimitVO | null>(null);
  const [limitForm] = Form.useForm<LimitForm>();
  const [pwdForm] = Form.useForm<PasswordForm>();
  const [savingLimit, setSavingLimit] = useState(false);
  const [otpOpen, setOtpOpen] = useState(false);
  const [pendingLimit, setPendingLimit] = useState<LimitForm | null>(null);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);

  const reload = useCallback(async () => {
    const [p, l] = await Promise.all([
      getProfile().catch(() => null),
      getTransferLimit().catch(() => null),
    ]);
    setProfile(p);
    setLimit(l);
    if (l) {
      limitForm.setFieldsValue({
        singleLimit: Number(l.singleLimit) / 100,
        dailyLimit: Number(l.dailyLimit) / 100,
      });
    }
    if (p?.customerId && p?.riskLevel === undefined) {
      latestRiskAssessment(p.customerId)
        .then((vo) => {
          if (vo?.level) setProfile((prev) => (prev ? { ...prev, riskLevel: vo.level } : prev));
        })
        .catch(() => undefined);
    }
  }, [limitForm]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const anyIncrease = (values: LimitForm): boolean => {
    if (!limit) return true; // 拿不到当前值时保守处理：需要 OTP
    return (
      yuanToFen(values.singleLimit) > Number(limit.singleLimit) ||
      yuanToFen(values.dailyLimit) > Number(limit.dailyLimit)
    );
  };

  const handleLimitSave = async (values: LimitForm) => {
    if (anyIncrease(values)) {
      // 上调需 OTP（scene=LIMIT）
      setPendingLimit(values);
      setOtpOpen(true);
      return;
    }
    setSavingLimit(true);
    try {
      await updateTransferLimit({
        singleLimit: yuanToFen(values.singleLimit),
        dailyLimit: yuanToFen(values.dailyLimit),
      });
      message.success('限额调整成功');
      void reload();
    } catch {
      // 拦截器已提示
    } finally {
      setSavingLimit(false);
    }
  };

  const doRaiseLimit = async (otpCode: string) => {
    if (!pendingLimit) return;
    await updateTransferLimit({
      singleLimit: yuanToFen(pendingLimit.singleLimit),
      dailyLimit: yuanToFen(pendingLimit.dailyLimit),
      otpCode,
    });
    setOtpOpen(false);
    message.success('限额上调成功');
    setPendingLimit(null);
    void reload();
  };

  const handleChangePassword = async (values: PasswordForm) => {
    setSavingPwd(true);
    try {
      await changePassword(values.oldPassword, values.newPassword);
      message.success('密码修改成功，下次登录请使用新密码');
      setPwdOpen(false);
      pwdForm.resetFields();
    } catch {
      // 拦截器已提示
    } finally {
      setSavingPwd(false);
    }
  };

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={12}>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Card title="客户资料">
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="客户号">{profile?.customerNo ?? profile?.customerId ?? '--'}</Descriptions.Item>
              <Descriptions.Item label="姓名">{profile?.realName ?? '--'}</Descriptions.Item>
              <Descriptions.Item label="登录名">{profile?.loginName ?? '--'}</Descriptions.Item>
              <Descriptions.Item label="预留手机">{maskMobile(profile?.mobile)}</Descriptions.Item>
              <Descriptions.Item label="风险等级">
                {profile?.riskLevel ? (
                  <Tag color={RISK_TAG_COLOR[profile.riskLevel] ?? 'blue'}>{profile.riskLevel}</Tag>
                ) : (
                  <Typography.Text type="secondary">未测评</Typography.Text>
                )}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card
            title="修改登录密码"
            extra={
              <Button type="primary" onClick={() => setPwdOpen(true)}>
                修改密码
              </Button>
            }
          >
            <Typography.Text type="secondary">
              密码策略：8~20 位，须同时包含字母和数字；连续 5 次失败将锁定 30 分钟。
            </Typography.Text>
          </Card>
        </Space>
      </Col>

      <Col xs={24} lg={12}>
        <Card title="转账限额调整">
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message="仅可自主下调限额；上调需短信验证码确认（培训环境可在弹窗中查看验证码）。"
          />
          <Descriptions column={1} size="small" bordered style={{ marginBottom: 16 }}>
            <Descriptions.Item label="当前单笔限额">{limit ? `${fenToYuan(limit.singleLimit)} 元` : '--'}</Descriptions.Item>
            <Descriptions.Item label="当前日累计限额">{limit ? `${fenToYuan(limit.dailyLimit)} 元` : '--'}</Descriptions.Item>
            <Descriptions.Item label="今日已用">{limit ? `${fenToYuan(limit.todayUsed)} 元` : '--'}</Descriptions.Item>
          </Descriptions>
          <Form<LimitForm> form={limitForm} layout="vertical" onFinish={handleLimitSave} requiredMark={false}>
            <Form.Item<LimitForm>
              name="singleLimit"
              label="单笔限额（元）"
              rules={[{ required: true, message: '请输入单笔限额' }]}
            >
              <InputNumber style={{ width: '100%' }} min={0.01} precision={2} addonAfter="元" />
            </Form.Item>
            <Form.Item<LimitForm>
              name="dailyLimit"
              label="日累计限额（元）"
              rules={[{ required: true, message: '请输入日累计限额' }]}
            >
              <InputNumber style={{ width: '100%' }} min={0.01} precision={2} addonAfter="元" />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={savingLimit}>
              保存限额
            </Button>
          </Form>
        </Card>
      </Col>

      {/* 限额上调 OTP 确认 */}
      <OtpModal
        open={otpOpen}
        scene="LIMIT"
        title="限额上调确认"
        description="上调转账限额需短信验证码确认，请输入验证码完成调整。"
        onCancel={() => {
          setOtpOpen(false);
          setPendingLimit(null);
        }}
        onVerify={doRaiseLimit}
      />

      {/* 修改密码 */}
      <Modal
        title="修改登录密码"
        open={pwdOpen}
        onCancel={() => setPwdOpen(false)}
        onOk={() => void pwdForm.submit()}
        okText="确认修改"
        okButtonProps={{ loading: savingPwd }}
        destroyOnClose
      >
        <Form<PasswordForm> form={pwdForm} layout="vertical" onFinish={handleChangePassword} requiredMark={false}>
          <Form.Item<PasswordForm>
            name="oldPassword"
            label="原密码"
            rules={[{ required: true, message: '请输入原密码' }]}
          >
            <Input.Password placeholder="请输入原密码" autoComplete="current-password" />
          </Form.Item>
          <Form.Item<PasswordForm>
            name="newPassword"
            label="新密码"
            extra="8~20 位，须同时包含字母和数字"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 8, message: '至少 8 位' },
              { max: 20, message: '最多 20 位' },
              {
                validator: (_, v?: string) =>
                  !v || (/[a-zA-Z]/.test(v) && /\d/.test(v))
                    ? Promise.resolve()
                    : Promise.reject(new Error('须同时包含字母和数字')),
              },
            ]}
          >
            <Input.Password placeholder="请设置新密码" autoComplete="new-password" />
          </Form.Item>
          <Form.Item<PasswordForm>
            name="confirmPassword"
            label="确认新密码"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: '请再次输入新密码' },
              ({ getFieldValue }) => ({
                validator: (_, v?: string) =>
                  !v || v === getFieldValue('newPassword')
                    ? Promise.resolve()
                    : Promise.reject(new Error('两次输入的密码不一致')),
              }),
            ]}
          >
            <Input.Password placeholder="请再次输入新密码" autoComplete="new-password" />
          </Form.Item>
        </Form>
      </Modal>
    </Row>
  );
}
