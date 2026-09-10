import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Form,
  InputNumber,
  Modal,
  Row,
  Statistic,
  Table,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { listWealthPositions, redeemWealth } from '../api/wealth';
import type { WealthPositionVO } from '../api/types';
import OtpModal from '../components/OtpModal';
import StatusBadge from '../components/StatusBadge';
import { fenToYuan, yuanToFen } from '../utils/money';
import { newRequestNo } from '../api/http';

interface RedeemForm {
  amount: number;
}

/** 可赎回的持仓状态（存续期 CONFIRMED/RUNNING 等） */
const REDEEMABLE = new Set(['CONFIRMED', 'RUNNING', 'HOLDING', 'PAY_SUCCESS']);

export default function HoldingsPage() {
  const [positions, setPositions] = useState<WealthPositionVO[]>([]);
  const [loading, setLoading] = useState(true);
  const [redeemTarget, setRedeemTarget] = useState<WealthPositionVO | null>(null);
  const [otpOpen, setOtpOpen] = useState(false);
  const [requestNo, setRequestNo] = useState('');
  const [form] = Form.useForm<RedeemForm>();

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setPositions(await listWealthPositions());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const totalCost = positions.reduce((sum, p) => sum + Number(p.costAmount), 0);
  const totalIncome = positions.reduce((sum, p) => sum + Number(p.accruingIncome) + Number(p.paidIncome), 0);

  const handleRedeemNext = async (values: RedeemForm) => {
    if (!redeemTarget) return;
    const shares = yuanToFen(values.amount);
    if (shares <= 0) {
      message.warning('请输入赎回金额');
      return;
    }
    // 1 元 = 1 份：持仓份额数即等值金额（元）
    if (values.amount > Number(redeemTarget.shares)) {
      message.warning(`超出可赎回份额（${Number(redeemTarget.shares)} 元）`);
      return;
    }
    setRequestNo(newRequestNo());
    setOtpOpen(true);
  };

  const doRedeem = async (otpCode: string) => {
    if (!redeemTarget) return;
    const values = await form.validateFields();
    try {
      const vo = await redeemWealth({
        requestNo,
        productCode: redeemTarget.productCode,
        shares: yuanToFen(values.amount), // 1 元 = 1 份：金额（分）即份额
        otpCode,
      });
      setOtpOpen(false);
      Modal.success({
        title: '赎回申请受理成功',
        content: (
          <div>
            <p>
              订单号：
              {vo?.orderNo ? <Typography.Text copyable>{vo.orderNo}</Typography.Text> : '--'}
            </p>
            <p>本金与已计提收益将于 T+1 日确认后到账活期账户。</p>
          </div>
        ),
      });
      setRedeemTarget(null);
      void reload();
    } catch {
      // 拦截器已提示（如 4007 份额不足）
    }
  };

  const columns: ColumnsType<WealthPositionVO> = [
    {
      title: '产品',
      dataIndex: 'productCode',
      render: (v: string, record) => (
        <div>
          <div>{record.productName || '--'}</div>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>{v}</Typography.Text>
        </div>
      ),
    },
    {
      title: '持有份额（份）',
      dataIndex: 'shares',
      align: 'right',
      render: (v: string) => Number(v).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    },
    { title: '本金（元）', dataIndex: 'costAmount', align: 'right', render: (v: string) => fenToYuan(v) },
    {
      title: '累计收益（元）',
      key: 'income',
      align: 'right',
      render: (_, record) => (
        <span style={{ color: '#389e0d' }}>
          {fenToYuan(Number(record.accruingIncome) + Number(record.paidIncome))}
        </span>
      ),
    },
    { title: '计提中（元）', dataIndex: 'accruingIncome', align: 'right', render: (v: string) => fenToYuan(v) },
    { title: '已付收益（元）', dataIndex: 'paidIncome', align: 'right', render: (v: string) => fenToYuan(v) },
    { title: '状态', dataIndex: 'productStatus', width: 110, render: (v: string) => <StatusBadge status={v} /> },
    {
      title: '操作',
      width: 100,
      render: (_, record) => {
        const redeemable = REDEEMABLE.has(record.productStatus);
        return (
          <Button
            type="link"
            size="small"
            disabled={!redeemable || Number(record.shares) <= 0}
            onClick={() => {
              setRedeemTarget(record);
              form.resetFields();
            }}
          >
            赎回
          </Button>
        );
      },
    },
  ];

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12}>
          <Card>
            <Statistic title="持仓本金合计（元）" value={fenToYuan(totalCost)} />
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card>
            <Statistic title="累计收益合计（元）" value={fenToYuan(totalIncome)} valueStyle={{ color: '#389e0d' }} />
          </Card>
        </Col>
      </Row>

      <Card title="我的理财持仓">
        <Table<WealthPositionVO>
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={positions}
          pagination={false}
          locale={{ emptyText: <Empty description="暂无持仓，去理财超市看看吧" /> }}
          scroll={{ x: 900 }}
        />
        <Alert
          style={{ marginTop: 16 }}
          type="info"
          showIcon
          message="赎回按金额办理：1 元 = 1 份，支持部分赎回；赎回本金与已计提收益 T+1 日到账。"
        />
      </Card>

      <Modal
        title={redeemTarget ? `赎回 ${redeemTarget.productName || redeemTarget.productCode}` : ''}
        open={!!redeemTarget}
        onCancel={() => setRedeemTarget(null)}
        onOk={() => void form.submit()}
        okText="下一步"
        destroyOnClose
      >
        {redeemTarget && (
          <>
            <Descriptions column={1} size="small" style={{ marginBottom: 16 }} bordered>
              <Descriptions.Item label="可赎回份额">
                {Number(redeemTarget.shares).toLocaleString('zh-CN', { minimumFractionDigits: 2 })} 份
                （约 {fenToYuan(Number(redeemTarget.shares) * 100)} 元）
              </Descriptions.Item>
              <Descriptions.Item label="计提中收益">{fenToYuan(redeemTarget.accruingIncome)} 元</Descriptions.Item>
            </Descriptions>
            <Form<RedeemForm> form={form} layout="vertical" onFinish={handleRedeemNext} requiredMark={false}>
              <Form.Item<RedeemForm>
                name="amount"
                label="赎回金额（元）"
                extra="按金额赎回：份额 = 金额 × 100（1 元 = 1 份）；赎回收益按已计提部分随本金到账"
                rules={[
                  { required: true, message: '请输入赎回金额' },
                  {
                    validator: (_, v: number) => {
                      if (!v || v <= 0) return Promise.reject(new Error('金额必须大于 0'));
                      // 1 元 = 1 份：份额数即等值金额（元）
                      if (v > Number(redeemTarget.shares)) {
                        return Promise.reject(new Error('超出可赎回份额'));
                      }
                      return Promise.resolve();
                    },
                  },
                ]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0.01}
                  precision={2}
                  placeholder="0.00"
                  addonAfter="元"
                />
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>

      <OtpModal
        open={otpOpen}
        scene="WEALTH"
        title="赎回确认"
        description={`赎回产品：${redeemTarget ? redeemTarget.productName || redeemTarget.productCode : ''}，请输入短信验证码完成赎回。`}
        onCancel={() => setOtpOpen(false)}
        onVerify={doRedeem}
      />
    </div>
  );
}
