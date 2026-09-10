import { useCallback, useEffect, useMemo, useState } from 'react';
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
  Popconfirm,
  Result,
  Row,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { addBeneficiary, deleteBeneficiary, getHome, getTransferLimit, listBeneficiaries, submitTransfer } from '../api/ebank';
import type { AccountVO, BeneficiaryVO, HomeVO, TransferLimitVO } from '../api/types';
import OtpModal from '../components/OtpModal';
import { maskAccount } from '../utils/mask';
import { fenToYuan, yuanToFen } from '../utils/money';
import { newRequestNo } from '../api/http';

const MANUAL_PAYEE = '__manual__';

interface TransferForm {
  fromAcct: string;
  payeeKey: string;
  toAcct?: string;
  toName?: string;
  amount: number;
  summary?: string;
}

interface BeneficiaryForm {
  payeeName: string;
  payeeAcct: string;
  alias?: string;
}

function TransferTab() {
  const navigate = useNavigate();
  const [form] = Form.useForm<TransferForm>();
  const [home, setHome] = useState<HomeVO | null>(null);
  const [limit, setLimit] = useState<TransferLimitVO | null>(null);
  const [beneficiaries, setBeneficiaries] = useState<BeneficiaryVO[]>([]);
  const [payeeKey, setPayeeKey] = useState<string>(MANUAL_PAYEE);
  const [otpOpen, setOtpOpen] = useState(false);
  const [requestNo, setRequestNo] = useState('');
  const [result, setResult] = useState<{ txnNo?: string; amount: number; toAcct: string; toName: string } | null>(null);

  const reload = useCallback(async () => {
    const [h, l, b] = await Promise.all([
      getHome().catch(() => null),
      getTransferLimit().catch(() => null),
      listBeneficiaries().catch(() => []),
    ]);
    setHome(h);
    setLimit(l);
    setBeneficiaries(b);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** 可用付款账户：活期且状态正常 */
  const demandAccounts: AccountVO[] = useMemo(
    () => (home?.accounts ?? []).filter((a) => a.acctType === 'DEMAND' && a.status === 'ACTIVE'),
    [home],
  );

  const selectedPayee = beneficiaries.find((b) => String(b.id) === payeeKey);
  const dailyRemain = limit ? Math.max(0, Number(limit.dailyLimit) - Number(limit.todayUsed)) : null;

  const handleSubmit = (values: TransferForm) => {
    const toAcct = selectedPayee ? selectedPayee.payeeAcct : values.toAcct?.trim();
    const toName = selectedPayee ? selectedPayee.payeeName : values.toName?.trim();
    if (!toAcct || !toName) {
      message.warning('请选择收款人或填写收款账号与户名');
      return;
    }
    if (dailyRemain !== null && yuanToFen(values.amount) > dailyRemain) {
      message.warning(`超出当日剩余可转额度 ${fenToYuan(dailyRemain)} 元`);
      return;
    }
    setRequestNo(newRequestNo()); // 前置生成幂等号，失败可原单重试
    setOtpOpen(true);
  };

  const doTransfer = async (otpCode: string) => {
    const values = await form.validateFields();
    const toAcct = selectedPayee ? selectedPayee.payeeAcct : values.toAcct?.trim() ?? '';
    const toName = selectedPayee ? selectedPayee.payeeName : values.toName?.trim() ?? '';
    try {
      const vo = await submitTransfer({
        requestNo,
        fromAcct: values.fromAcct,
        toAcct,
        toName,
        amount: yuanToFen(values.amount),
        summary: values.summary?.trim() || undefined,
        otpCode,
      });
      setOtpOpen(false);
      setResult({ txnNo: vo?.txnNo, amount: values.amount, toAcct, toName });
      void reload();
    } catch {
      // 拦截器已提示；弹窗保持打开可修正重试（requestNo 幂等）
    }
  };

  if (result) {
    return (
      <Card>
        <Result
          status="success"
          title="转账成功"
          subTitle="资金已实时入账（本行账户）"
          extra={[
            <Space key="actions" direction="vertical" size="middle" style={{ width: '100%' }}>
              <Descriptions column={1} bordered size="small" style={{ maxWidth: 480, textAlign: 'left' }}>
                <Descriptions.Item label="交易流水号">
                  {result.txnNo ? <Typography.Text copyable>{result.txnNo}</Typography.Text> : '--'}
                </Descriptions.Item>
                <Descriptions.Item label="收款账户">{maskAccount(result.toAcct)}</Descriptions.Item>
                <Descriptions.Item label="收款人">{result.toName}</Descriptions.Item>
                <Descriptions.Item label="金额（元）">{fenToYuan(yuanToFen(result.amount))}</Descriptions.Item>
              </Descriptions>
              <Space>
                <Button type="primary" onClick={() => navigate('/receipts')}>
                  查看电子回单
                </Button>
                <Button
                  onClick={() => {
                    setResult(null);
                    form.resetFields();
                  }}
                >
                  再转一笔
                </Button>
              </Space>
            </Space>,
          ]}
        />
      </Card>
    );
  }

  return (
    <>
      <Row gutter={16}>
        <Col xs={24} lg={14}>
          <Card title="行内转账">
            <Form<TransferForm>
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              initialValues={{ payeeKey: MANUAL_PAYEE }}
              requiredMark={false}
            >
              <Form.Item name="fromAcct" label="付款账户" rules={[{ required: true, message: '请选择付款账户' }]}>
                <Select placeholder="请选择活期账户" options={demandAccounts.map((a) => ({ value: a.acctNo, label: `${maskAccount(a.acctNo)}（余额 ${fenToYuan(a.balance)} 元）` }))} />
              </Form.Item>

              <Form.Item name="payeeKey" label="收款人" rules={[{ required: true, message: '请选择收款人' }]}>
                <Select
                  placeholder="从名册选择或手动输入"
                  onChange={(v: string) => setPayeeKey(v)}
                  options={[
                    ...beneficiaries.map((b) => ({
                      value: String(b.id),
                      label: `${b.alias ? `${b.alias} · ` : ''}${b.payeeName}（${maskAccount(b.payeeAcct)}）`,
                    })),
                    { value: MANUAL_PAYEE, label: '+ 手动输入新收款人' },
                  ]}
                />
              </Form.Item>

              {payeeKey === MANUAL_PAYEE && (
                <Row gutter={12}>
                  <Col xs={24} sm={12}>
                    <Form.Item name="toAcct" label="收款账号" rules={[{ required: true, message: '请输入收款账号' }]}>
                      <Input placeholder="AirBank 账号（仅支持本行）" maxLength={18} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item name="toName" label="收款人户名" rules={[{ required: true, message: '请输入收款人户名' }]}>
                      <Input placeholder="须与收款账户户名一致" />
                    </Form.Item>
                  </Col>
                </Row>
              )}

              <Form.Item
                name="amount"
                label="转账金额（元）"
                rules={[
                  { required: true, message: '请输入转账金额' },
                  {
                    validator: (_, v: number) =>
                      v && v > 0 ? Promise.resolve() : Promise.reject(new Error('金额必须大于 0')),
                  },
                ]}
              >
                <InputNumber<number>
                  style={{ width: 240 }}
                  min={0.01}
                  precision={2}
                  placeholder="0.00"
                  addonAfter="元"
                  formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(v) => Number((v || '').replace(/,/g, ''))}
                />
              </Form.Item>

              <Form.Item name="summary" label="备注（选填）">
                <Input placeholder="转账摘要，将显示在回单与明细" maxLength={64} />
              </Form.Item>

              <Button type="primary" htmlType="submit" size="large" style={{ minWidth: 160 }}>
                下一步：验证码确认
              </Button>
              <Typography.Text type="secondary" style={{ marginLeft: 12, fontSize: 12 }}>
                到账提示：本行账户实时到账
              </Typography.Text>
            </Form>
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="转账限额">
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="单笔限额">{limit ? `${fenToYuan(limit.singleLimit)} 元` : '--'}</Descriptions.Item>
              <Descriptions.Item label="日累计限额">{limit ? `${fenToYuan(limit.dailyLimit)} 元` : '--'}</Descriptions.Item>
              <Descriptions.Item label="今日已用">{limit ? `${fenToYuan(limit.todayUsed)} 元` : '--'}</Descriptions.Item>
              <Descriptions.Item label="今日剩余">
                {dailyRemain !== null ? (
                  <Typography.Text strong>{fenToYuan(dailyRemain)} 元</Typography.Text>
                ) : (
                  '--'
                )}
              </Descriptions.Item>
            </Descriptions>
            <Alert
              style={{ marginTop: 12 }}
              type="info"
              showIcon
              message="限额可在「安全设置」中自主下调；上调需短信验证码确认。"
            />
          </Card>
        </Col>
      </Row>

      <OtpModal
        open={otpOpen}
        scene="TRANSFER"
        title="转账确认"
        description="资金操作需短信验证码二次确认，验证码已发送至您的预留手机。"
        onCancel={() => setOtpOpen(false)}
        onVerify={doTransfer}
      />
    </>
  );
}

function BeneficiaryTab() {
  const [list, setList] = useState<BeneficiaryVO[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<BeneficiaryForm>();

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setList(await listBeneficiaries());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleAdd = async (values: BeneficiaryForm) => {
    setSaving(true);
    try {
      await addBeneficiary({
        payeeName: values.payeeName.trim(),
        payeeAcct: values.payeeAcct.trim(),
        alias: values.alias?.trim() || undefined,
      });
      message.success('收款人已添加');
      setModalOpen(false);
      form.resetFields();
      void reload();
    } catch {
      // 拦截器已提示（如 6005 户名不符）
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnsType<BeneficiaryVO> = [
    { title: '备注名', dataIndex: 'alias', render: (v?: string) => v || '--' },
    { title: '收款人', dataIndex: 'payeeName' },
    { title: '收款账号', dataIndex: 'payeeAcct', render: (v: string) => <Typography.Text copyable>{v}</Typography.Text> },
    { title: '收款银行', width: 120, render: () => <Tag>AirBank（本行）</Tag> },
    {
      title: '操作',
      width: 100,
      render: (_, record) => (
        <Popconfirm
          title="删除收款人"
          description="确定从名册中删除该收款人？"
          onConfirm={async () => {
            await deleteBeneficiary(record.id);
            message.success('已删除');
            void reload();
          }}
        >
          <Button type="link" danger size="small" icon={<DeleteOutlined />}>
            删除
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <Card
      title="收款人名册"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          新增收款人
        </Button>
      }
    >
      <Table<BeneficiaryVO> rowKey="id" loading={loading} columns={columns} dataSource={list} pagination={false} />
      <Modal
        title="新增收款人"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={async () => {
          const values = await form.validateFields();
          await handleAdd(values);
        }}
        okText="保存"
        okButtonProps={{ loading: saving }}
        destroyOnClose
      >
        <Form<BeneficiaryForm> form={form} layout="vertical" requiredMark={false}>
          <Form.Item name="payeeAcct" label="收款账号" rules={[{ required: true, message: '请输入收款账号' }]}>
            <Input placeholder="AirBank 账号" maxLength={18} />
          </Form.Item>
          <Form.Item name="payeeName" label="收款人户名" rules={[{ required: true, message: '请输入户名' }]} extra="保存时将校验账号与户名一致性">
            <Input placeholder="须与收款账户户名一致" />
          </Form.Item>
          <Form.Item name="alias" label="备注名（选填）">
            <Input placeholder="如：房租-王阿姨" maxLength={20} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}

export default function TransferPage() {
  return (
    <Tabs
      defaultActiveKey="transfer"
      items={[
        { key: 'transfer', label: '转账汇款', children: <TransferTab /> },
        { key: 'beneficiaries', label: '收款人名册', children: <BeneficiaryTab /> },
      ]}
    />
  );
}
