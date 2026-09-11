import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Descriptions,
  Drawer,
  Empty,
  Form,
  InputNumber,
  Modal,
  Progress,
  Row,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import { listWealthProducts, subscribeWealth } from '../api/wealth';
import type { WealthProductVO } from '../api/types';
import OtpModal from '../components/OtpModal';
import RiskTag, { riskRank } from '../components/RiskTag';
import StatusBadge from '../components/StatusBadge';
import { useAuthStore } from '../stores/auth';
import { fenToYuan, formatRate, yuanToFen } from '../utils/money';
import { newRequestNo } from '../api/http';

const TERM_OPTIONS = [
  { value: 'ALL', label: '全部期限' },
  { value: 'SHORT', label: '90 天以内' },
  { value: 'MID', label: '90~180 天' },
  { value: 'LONG', label: '180 天以上' },
];

const RISK_OPTIONS = [
  { value: 'ALL', label: '全部风险等级' },
  { value: 'R1', label: 'R1 低风险' },
  { value: 'R2', label: 'R2 中风险' },
  { value: 'R3', label: 'R3 高风险' },
];

/** 我的客户风险等级（C1~C5）→ 可购产品风险上限（C1↔R1 ... C3↔R3，C4/C5 可购全部） */
function maxBuyableRisk(myLevel?: string | null): number {
  switch (myLevel) {
    case 'C1':
      return 1;
    case 'C2':
      return 2;
    case 'C3':
      return 3;
    case 'C4':
    case 'C5':
      return 3;
    default:
      return 0; // 未测评：不可购买
  }
}

interface AmountForm {
  amount: number;
  agreed: boolean;
}

export default function WealthPage() {
  const user = useAuthStore((s) => s.user);
  const [products, setProducts] = useState<WealthProductVO[]>([]);
  const [loading, setLoading] = useState(true);
  const [termFilter, setTermFilter] = useState('ALL');
  const [riskFilter, setRiskFilter] = useState('ALL');
  const [detail, setDetail] = useState<WealthProductVO | null>(null);
  const [buyTarget, setBuyTarget] = useState<WealthProductVO | null>(null);
  const [otpOpen, setOtpOpen] = useState(false);
  const [requestNo, setRequestNo] = useState('');
  const [form] = Form.useForm<AmountForm>();

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setProducts(await listWealthProducts());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (riskFilter !== 'ALL' && p.riskLevel !== riskFilter) return false;
      if (termFilter === 'SHORT' && p.termDays > 90) return false;
      if (termFilter === 'MID' && (p.termDays < 91 || p.termDays > 180)) return false;
      if (termFilter === 'LONG' && p.termDays <= 180) return false;
      return true;
    });
  }, [products, termFilter, riskFilter]);

  /** 可购性判断：在售 + 风险等级匹配 */
  const buyDisabledInfo = (p: WealthProductVO): { disabled: boolean; reason?: string } => {
    if (p.status !== 'ON_SALE') {
      return { disabled: true, reason: `当前状态不可购买（${p.status}）` };
    }
    const myRank = maxBuyableRisk(user?.riskLevel);
    if (myRank === 0) {
      return { disabled: true, reason: '请先完成风险测评（安全设置 → 风险测评）' };
    }
    if (riskRank(p.riskLevel) > myRank) {
      return { disabled: true, reason: `您的风险等级 ${user?.riskLevel} 低于产品风险 ${p.riskLevel}，暂不可购买` };
    }
    return { disabled: false };
  };

  const openBuy = (p: WealthProductVO) => {
    setDetail(null);
    setBuyTarget(p);
    form.resetFields();
  };

  const handleAmountNext = async (values: AmountForm) => {
    if (!buyTarget) return;
    const fen = yuanToFen(values.amount);
    if (fen < Number(buyTarget.minAmount)) {
      message.warning(`起购金额 ${fenToYuan(buyTarget.minAmount)} 元`);
      return;
    }
    if (buyTarget.stepAmount && fen > Number(buyTarget.minAmount)) {
      const step = Number(buyTarget.stepAmount);
      const over = (fen - Number(buyTarget.minAmount)) % step;
      if (over !== 0) {
        message.warning(`递增金额为 ${fenToYuan(step)} 元，请按起购金额 + N×递增金额填写`);
        return;
      }
    }
    if (fen > Number(buyTarget.maxSingleAmount)) {
      message.warning(`单笔上限 ${fenToYuan(buyTarget.maxSingleAmount)} 元`);
      return;
    }
    setRequestNo(newRequestNo());
    setOtpOpen(true);
  };

  const doSubscribe = async (otpCode: string) => {
    if (!buyTarget) return;
    const values = await form.validateFields();
    try {
      const vo = await subscribeWealth({
        requestNo,
        productCode: buyTarget.productCode,
        amount: yuanToFen(values.amount),
        otpCode,
      });
      setOtpOpen(false);
      Modal.success({
        title: '申购受理成功',
        content: (
          <div>
            <p>
              订单号：
              {vo?.orderNo ? <Typography.Text copyable>{vo.orderNo}</Typography.Text> : '--'}
            </p>
            <p>T+1 日确认批量后生效，可在「理财 → 交易记录」查看进度。</p>
          </div>
        ),
      });
      setBuyTarget(null);
      void reload();
    } catch {
      // 拦截器已提示（如 4003 风险不匹配 / 4004 低于起购）
    }
  };

  return (
    <div>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Typography.Text strong>我的风险等级：</Typography.Text>
          {user?.riskLevel ? (
            <Tag color={user.riskLevel === 'C1' ? 'green' : user.riskLevel === 'C5' ? 'red' : 'blue'}>
              {user.riskLevel}
            </Tag>
          ) : (
            <Tag>未测评</Tag>
          )}
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            只能购买风险等级不高于自身等级的产品（C4/C5 可购全部）；等级可在「风险测评」页更新。
          </Typography.Text>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <Select value={termFilter} onChange={setTermFilter} options={TERM_OPTIONS} style={{ width: 140 }} />
            <Select value={riskFilter} onChange={setRiskFilter} options={RISK_OPTIONS} style={{ width: 150 }} />
          </div>
        </Space>
      </Card>

      <Row gutter={[16, 16]}>
        {loading ? (
          [1, 2, 3].map((i) => (
            <Col xs={24} sm={12} lg={8} key={i}>
              <Card loading />
            </Col>
          ))
        ) : filtered.length === 0 ? (
          <Col span={24}>
            <Card>
              <Empty description="没有符合筛选条件的产品" />
            </Card>
          </Col>
        ) : (
          filtered.map((p) => {
            const { disabled, reason } = buyDisabledInfo(p);
            return (
              <Col xs={24} sm={12} lg={8} key={p.productCode}>
                <Card
                  hoverable
                  onClick={() => setDetail(p)}
                  title={
                    <Space>
                      <span>{p.productName}</span>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>{p.productCode}</Typography.Text>
                    </Space>
                  }
                  extra={<StatusBadge status={p.status} />}
                >
                  <Row align="bottom" gutter={8}>
                    <Col>
                      <Typography.Text style={{ fontSize: 32, color: '#0D9488', fontWeight: 600, lineHeight: 1 }}>
                        {formatRate(p.annualRate)}
                      </Typography.Text>
                    </Col>
                    <Col style={{ paddingBottom: 4 }}>
                      <Typography.Text type="secondary">业绩基准（年化）</Typography.Text>
                    </Col>
                    <Col style={{ paddingBottom: 2, marginLeft: 'auto' }}>
                      <RiskTag level={p.riskLevel} />
                    </Col>
                  </Row>
                  <Descriptions column={2} size="small" style={{ marginTop: 12 }}>
                    <Descriptions.Item label="期限">{p.termDays} 天</Descriptions.Item>
                    <Descriptions.Item label="起购">{fenToYuan(p.minAmount)} 元</Descriptions.Item>
                  </Descriptions>
                  <Tooltip title={disabled ? reason : undefined}>
                    <Button
                      type="primary"
                      block
                      style={{ marginTop: 12 }}
                      disabled={disabled}
                      onClick={(e) => {
                        e.stopPropagation();
                        openBuy(p);
                      }}
                    >
                      {disabled ? '不可购买' : '立即购买'}
                    </Button>
                  </Tooltip>
                </Card>
              </Col>
            );
          })
        )}
      </Row>

      {/* 详情抽屉 */}
      <Drawer
        title={detail ? `${detail.productName}（${detail.productCode}）` : ''}
        width={420}
        open={!!detail}
        onClose={() => setDetail(null)}
      >
        {detail && (
          <>
            <Row align="bottom" gutter={8} style={{ marginBottom: 16 }}>
              <Col>
                <Typography.Text style={{ fontSize: 40, color: '#0D9488', fontWeight: 600, lineHeight: 1 }}>
                  {formatRate(detail.annualRate)}
                </Typography.Text>
              </Col>
              <Col style={{ paddingBottom: 6 }}>
                <Typography.Text type="secondary">业绩基准（年化）</Typography.Text>
              </Col>
            </Row>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="产品代码">{detail.productCode}</Descriptions.Item>
              <Descriptions.Item label="风险等级"><RiskTag level={detail.riskLevel} /></Descriptions.Item>
              <Descriptions.Item label="产品状态"><StatusBadge status={detail.status} /></Descriptions.Item>
              <Descriptions.Item label="期限">{detail.termDays} 天（到期自动清算至活期）</Descriptions.Item>
              <Descriptions.Item label="起购金额">{fenToYuan(detail.minAmount)} 元</Descriptions.Item>
              <Descriptions.Item label="递增金额">{fenToYuan(detail.stepAmount)} 元</Descriptions.Item>
              <Descriptions.Item label="单笔上限">{fenToYuan(detail.maxSingleAmount)} 元</Descriptions.Item>
              <Descriptions.Item label="募集进度">
                <div style={{ width: 180 }}>
                  <Progress
                    percent={
                      Number(detail.raiseLimit) > 0
                        ? Math.min(100, Math.round((Number(detail.raisedAmount) / Number(detail.raiseLimit)) * 100))
                        : 0
                    }
                    size="small"
                  />
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {fenToYuan(detail.raisedAmount)} / {fenToYuan(detail.raiseLimit)} 元
                  </Typography.Text>
                </div>
              </Descriptions.Item>
            </Descriptions>
            <Alert
              style={{ marginTop: 16 }}
              type="warning"
              showIcon
              message="理财非存款，产品有风险，投资须谨慎。业绩基准不代表未来收益承诺。"
            />
            <Button
              type="primary"
              block
              size="large"
              style={{ marginTop: 16 }}
              disabled={buyDisabledInfo(detail).disabled}
              onClick={() => openBuy(detail)}
            >
              {buyDisabledInfo(detail).disabled ? (buyDisabledInfo(detail).reason ?? '不可购买') : '立即购买'}
            </Button>
          </>
        )}
      </Drawer>

      {/* 购买金额 + 风险提示 */}
      <Modal
        title={buyTarget ? `购买 ${buyTarget.productName}` : ''}
        open={!!buyTarget}
        onCancel={() => setBuyTarget(null)}
        onOk={() => void form.submit()}
        okText="下一步"
        destroyOnClose
      >
        {buyTarget && (
          <Form<AmountForm> form={form} layout="vertical" onFinish={handleAmountNext} requiredMark={false}>
            <Descriptions column={1} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="起购金额">{fenToYuan(buyTarget.minAmount)} 元</Descriptions.Item>
              <Descriptions.Item label="递增金额">{fenToYuan(buyTarget.stepAmount)} 元</Descriptions.Item>
              <Descriptions.Item label="单笔上限">{fenToYuan(buyTarget.maxSingleAmount)} 元</Descriptions.Item>
            </Descriptions>
            <Form.Item<AmountForm>
              name="amount"
              label="购买金额（元）"
              rules={[
                { required: true, message: '请输入购买金额' },
                { validator: (_, v: number) => (v && v > 0 ? Promise.resolve() : Promise.reject(new Error('金额必须大于 0'))) },
              ]}
            >
              <InputNumber style={{ width: '100%' }} min={0.01} precision={2} placeholder="0.00" addonAfter="元" />
            </Form.Item>
            <Form.Item<AmountForm>
              name="agreed"
              valuePropName="checked"
              rules={[
                {
                  validator: (_, v: boolean) =>
                    v ? Promise.resolve() : Promise.reject(new Error('请阅读并勾选风险提示')),
                },
              ]}
            >
              <Checkbox>
                我已阅读产品说明书与风险揭示书，知悉<b>理财非存款、产品有风险、投资须谨慎</b>
                ，产品业绩基准不构成收益承诺。
              </Checkbox>
            </Form.Item>
          </Form>
        )}
      </Modal>

      {/* OTP 确认 */}
      <OtpModal
        open={otpOpen}
        scene="WEALTH"
        title="申购确认"
        description={`购买产品：${buyTarget?.productName ?? ''}，请输入短信验证码完成申购。`}
        onCancel={() => setOtpOpen(false)}
        onVerify={doSubscribe}
      />
    </div>
  );
}
