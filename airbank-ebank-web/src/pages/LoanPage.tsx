import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Descriptions,
  Empty,
  Form,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd';
import { applyLoan, listLoanProducts } from '../api/loan';
import type { LoanApplicationVO, LoanProductVO } from '../api/types';
import OtpModal from '../components/OtpModal';
import StatusBadge from '../components/StatusBadge';
import { fenToYuan, formatRate } from '../utils/money';
import { newRequestNo } from '../api/http';

const PURPOSE_OPTIONS = [
  { value: '日常消费', label: '日常消费' },
  { value: '装修家装', label: '装修家装' },
  { value: '教育培训', label: '教育培训' },
  { value: '医疗支出', label: '医疗支出' },
  { value: '经营周转', label: '经营周转' },
  { value: '其他', label: '其他' },
];

interface ApplyForm {
  amount: number;
  termMonths: number;
  purpose: string;
  agreed: boolean;
}

/** 贷款超市：产品卡片 + 在线申请（OTP → 联网核查/征信/审批/放款 一站式） */
export default function LoanPage() {
  const [products, setProducts] = useState<LoanProductVO[]>([]);
  const [loading, setLoading] = useState(true);
  const [applyTarget, setApplyTarget] = useState<LoanProductVO | null>(null);
  const [otpOpen, setOtpOpen] = useState(false);
  const [requestNo, setRequestNo] = useState('');
  const [form] = Form.useForm<ApplyForm>();

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setProducts(await listLoanProducts());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const openApply = (p: LoanProductVO) => {
    setApplyTarget(p);
    form.resetFields();
  };

  const handleNext = async () => {
    const values = await form.validateFields();
    if (!applyTarget) return;
    const fen = Math.round(values.amount * 100);
    if (fen < Number(applyTarget.minAmount) || fen > Number(applyTarget.maxAmount)) {
      Modal.warning({
        title: '借款金额超出范围',
        content: `该产品可借金额为 ${fenToYuan(applyTarget.minAmount)} ~ ${fenToYuan(applyTarget.maxAmount)} 元`,
      });
      return;
    }
    setRequestNo(newRequestNo());
    setOtpOpen(true);
  };

  const doApply = async (otpCode: string) => {
    if (!applyTarget) return;
    const values = await form.validateFields();
    try {
      const app: LoanApplicationVO = await applyLoan({
        requestNo,
        productCode: applyTarget.productCode,
        amount: values.amount,
        termMonths: values.termMonths,
        purpose: values.purpose,
        otpCode,
      });
      setOtpOpen(false);
      setApplyTarget(null);
      if (app.status === 'DISBURSED') {
        Modal.success({
          title: '放款成功',
          content: (
            <div>
              <p>借据号：{app.loanNo ? <Typography.Text copyable>{app.loanNo}</Typography.Text> : '--'}</p>
              <p>
                放款金额 ¥{fenToYuan(app.approveAmount)}（执行年利率 {formatRate(app.approveRate)}），
                已入您的活期账户；按月等额本息还款，可在「贷款 → 我的贷款」查看还款计划。
              </p>
              {Number(app.approveAmount) < Math.round(values.amount * 100) && (
                <p style={{ color: '#D97706' }}>
                  注：根据征信评分核定额度，实际放款低于申请金额（部分批准）。
                </p>
              )}
            </div>
          ),
        });
      } else {
        Modal.info({
          title: '申请未获批准',
          content: (
            <div>
              <p>申请编号：{app.applyNo}</p>
              <p>原因：{app.rejectReason ?? '综合评分不足'}</p>
              {app.creditScore ? <p>征信评分（模拟）：{app.creditScore}</p> : null}
            </div>
          ),
        });
      }
      void reload();
    } catch {
      // 错误提示由拦截器统一处理
    }
  };

  return (
    <div>
      <Alert
        style={{ marginBottom: 16 }}
        type="info"
        showIcon
        message="线上小额信贷：提交申请后将自动完成联网核查与征信查询（本环境为模拟外联），审批通过即刻放款至活期账户。"
      />
      <Row gutter={[16, 16]}>
        {loading ? (
          [1, 2, 3].map((i) => (
            <Col xs={24} sm={12} lg={8} key={i}>
              <Card loading />
            </Col>
          ))
        ) : products.length === 0 ? (
          <Col span={24}>
            <Card>
              <Empty description="暂无可申请产品" />
            </Card>
          </Col>
        ) : (
          products.map((p) => (
            <Col xs={24} sm={12} lg={8} key={p.productCode}>
              <Card
                hoverable
                title={
                  <Space>
                    <span>{p.productName}</span>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {p.productCode}
                    </Typography.Text>
                  </Space>
                }
                extra={<StatusBadge status={p.status} />}
              >
                <Row align="bottom" gutter={8}>
                  <Col>
                    <Typography.Text style={{ fontSize: 32, color: '#B45309', fontWeight: 600, lineHeight: 1 }}>
                      {formatRate(p.annualRate)}
                    </Typography.Text>
                  </Col>
                  <Col style={{ paddingBottom: 4 }}>
                    <Typography.Text type="secondary">基准年利率（起）</Typography.Text>
                  </Col>
                </Row>
                <Descriptions column={1} size="small" style={{ marginTop: 12 }}>
                  <Descriptions.Item label="可借额度">
                    {fenToYuan(p.minAmount)} ~ {fenToYuan(p.maxAmount)} 元
                  </Descriptions.Item>
                  <Descriptions.Item label="可选期限">{p.termOptions} 个月</Descriptions.Item>
                  <Descriptions.Item label="还款方式">等额本息（按月）</Descriptions.Item>
                </Descriptions>
                <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8 }} ellipsis={{ rows: 2 }}>
                  {p.description}
                </Typography.Paragraph>
                <Button
                  type="primary"
                  block
                  disabled={p.status !== 'ON_SALE'}
                  onClick={() => openApply(p)}
                >
                  {p.status === 'ON_SALE' ? '立即申请' : '暂不可申请'}
                </Button>
              </Card>
            </Col>
          ))
        )}
      </Row>

      {/* 申请表单 */}
      <Modal
        title={applyTarget ? `申请 ${applyTarget.productName}` : ''}
        open={!!applyTarget}
        onCancel={() => setApplyTarget(null)}
        onOk={() => void handleNext()}
        okText="下一步"
        destroyOnClose
      >
        {applyTarget && (
          <Form<ApplyForm> form={form} layout="vertical" requiredMark={false}>
            <Descriptions column={1} size="small" style={{ marginBottom: 12 }}>
              <Descriptions.Item label="可借额度">
                {fenToYuan(applyTarget.minAmount)} ~ {fenToYuan(applyTarget.maxAmount)} 元
              </Descriptions.Item>
              <Descriptions.Item label="基准年利率">
                {formatRate(applyTarget.annualRate)}（实际利率以审批为准，征信评分越低利率越高）
              </Descriptions.Item>
            </Descriptions>
            <Form.Item<ApplyForm>
              name="amount"
              label="借款金额（元）"
              rules={[
                { required: true, message: '请输入借款金额' },
                { validator: (_, v: number) => (v && v > 0 ? Promise.resolve() : Promise.reject(new Error('金额必须大于 0'))) },
              ]}
            >
              <InputNumber style={{ width: '100%' }} min={0.01} precision={2} placeholder="0.00" addonAfter="元" />
            </Form.Item>
            <Form.Item<ApplyForm>
              name="termMonths"
              label="借款期限"
              rules={[{ required: true, message: '请选择借款期限' }]}
            >
              <Select
                placeholder="请选择"
                options={applyTarget.termOptions.split(',').map((t) => ({
                  value: Number(t.trim()),
                  label: `${t.trim()} 个月`,
                }))}
              />
            </Form.Item>
            <Form.Item<ApplyForm>
              name="purpose"
              label="借款用途"
              rules={[{ required: true, message: '请选择借款用途' }]}
            >
              <Select placeholder="请选择" options={PURPOSE_OPTIONS} />
            </Form.Item>
            <Form.Item<ApplyForm>
              name="agreed"
              valuePropName="checked"
              rules={[
                {
                  validator: (_, v: boolean) =>
                    v ? Promise.resolve() : Promise.reject(new Error('请阅读并勾选授权条款')),
                },
              ]}
            >
              <Checkbox>
                本人同意并授权 AirBank 查询<b>联网核查</b>与<b>个人征信</b>信息（本环境为模拟外联），
                并承诺借款用于合法合规用途。
              </Checkbox>
            </Form.Item>
            <Tag color="blue">审批通过后立即放款至本人活期账户</Tag>
          </Form>
        )}
      </Modal>

      {/* OTP 确认 */}
      <OtpModal
        open={otpOpen}
        scene="LOAN"
        title="贷款申请确认"
        description={`申请产品：${applyTarget?.productName ?? ''}，请输入短信验证码确认提交申请。`}
        onCancel={() => setOtpOpen(false)}
        onVerify={doApply}
      />
    </div>
  );
}
