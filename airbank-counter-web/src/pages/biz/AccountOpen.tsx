import { useState } from 'react';
import { Alert, Button, Card, Descriptions, Flex, Form, Input, InputNumber, Radio, Select, Space, Steps } from 'antd';
import { submitTxn } from '../../api/counter';
import { newRequestNo } from '../../api/http';
import type { NewCustomer, TxnResult } from '../../api/types';
import MoneyInput from '../../components/MoneyInput';
import TxnResultModal from '../../components/TxnResultModal';
import { fenToYuan, yuanToFen } from '../../utils/money';

const ID_TYPES = [
  { value: '01', label: '居民身份证' },
  { value: '02', label: '户口簿' },
  { value: '03', label: '护照' },
  { value: '05', label: '其他证件' },
];
const GENDERS = [
  { value: '1', label: '男' },
  { value: '2', label: '女' },
];

interface OpenForm {
  customerId?: string;
  customerName?: string;
  idType?: string;
  idNo?: string;
  mobile?: string;
  gender?: string;
  occupation?: string;
  address?: string;
  amount?: number;
}

/** 开户：客户新建/已选客户 二步表单 → 初始存款 → 提交（回执含账号/卡号可复制） */
export default function AccountOpen() {
  const [form] = Form.useForm<OpenForm>();
  const [mode, setMode] = useState<'new' | 'exist'>('new');
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [values, setValues] = useState<OpenForm>({});
  const [result, setResult] = useState<TxnResult | null>(null);

  const toConfirm = async () => {
    try {
      setValues(await form.validateFields());
      setStep(1);
    } catch {
      /* 校验失败 */
    }
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const payload = {
        bizType: 'ACCOUNT_OPEN',
        requestNo: newRequestNo(),
        amount: yuanToFen(values.amount ?? 0),
        ...(mode === 'new'
          ? {
              customerCmd: 'CREATE',
              customer: {
                customerName: values.customerName!,
                idType: values.idType || '01',
                idNo: values.idNo!,
                mobile: values.mobile!,
                gender: values.gender,
                occupation: values.occupation,
                address: values.address,
              } as NewCustomer,
            }
          : { customerId: String(values.customerId ?? '') }),
      };
      const res = await submitTxn(payload);
      setResult(res);
    } catch {
      /* 拦截器已提示 */
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    form.resetFields();
    setValues({});
    setStep(0);
    setResult(null);
  };

  const customerDesc = mode === 'new'
    ? `新建客户：${values.customerName ?? '-'} / ${values.idType === undefined || values.idType === '' ? '01' : values.idType} / ${values.idNo ?? '-'} / ${values.mobile ?? '-'}`
    : `已有客户：客户号 ${values.customerId ?? '-'}`;

  return (
    <Card title="开户（存折 / 借记卡）">
      <p style={{ color: 'rgba(0,0,0,0.45)', marginTop: 0 }}>
        初始存款 ≥ 5 万元将自动转入主管授权队列（PENDING_REVIEW）。
      </p>
      <Steps size="small" current={step} items={[{ title: '客户与要素' }, { title: '确认提交' }]} style={{ maxWidth: 460, marginBottom: 24 }} />

      {step === 0 && (
        <Form form={form} layout="vertical" style={{ maxWidth: 560 }} initialValues={{ idType: '01' }}>
          <Form.Item label="客户">
            <Radio.Group
              value={mode}
              onChange={(e) => {
                setMode(e.target.value as 'new' | 'exist');
                form.resetFields();
                form.setFieldValue('idType', '01');
              }}
              optionType="button"
              options={[
                { value: 'new', label: '新建客户' },
                { value: 'exist', label: '已有客户' },
              ]}
            />
          </Form.Item>

          {mode === 'exist' ? (
            <Form.Item
              name="customerId"
              label="客户号"
              rules={[{ required: true, message: '请输入客户号' }]}
            >
              <InputNumber<number | string>
                style={{ width: '100%' }}
                placeholder="客户号（10 开头）"
                controls={false}
              />
            </Form.Item>
          ) : (
            <>
              <Form.Item name="customerName" label="客户姓名" rules={[{ required: true, message: '请输入客户姓名' }]}>
                <Input placeholder="客户姓名" maxLength={64} />
              </Form.Item>
              <Space size="large">
                <Form.Item name="idType" label="证件类型" style={{ minWidth: 180 }}>
                  <Select options={ID_TYPES} disabled />
                </Form.Item>
                <Form.Item
                  name="idNo"
                  label="证件号码"
                  rules={[
                    { required: true, message: '请输入证件号码' },
                    { pattern: /^[0-9Xx]{15,18}$/, message: '证件号码格式不正确' },
                  ]}
                >
                  <Input placeholder="身份证号码" maxLength={18} style={{ width: 260 }} />
                </Form.Item>
              </Space>
              <Space size="large">
                <Form.Item
                  name="mobile"
                  label="手机号"
                  rules={[
                    { required: true, message: '请输入手机号' },
                    { pattern: /^1\d{10}$/, message: '手机号格式不正确' },
                  ]}
                >
                  <Input placeholder="11 位手机号" maxLength={11} style={{ width: 220 }} />
                </Form.Item>
                <Form.Item name="gender" label="性别">
                  <Select options={GENDERS} placeholder="请选择" allowClear style={{ width: 140 }} />
                </Form.Item>
              </Space>
              <Form.Item name="occupation" label="职业">
                <Input placeholder="职业（选填）" maxLength={64} />
              </Form.Item>
              <Form.Item name="address" label="联系地址">
                <Input placeholder="联系地址（选填）" maxLength={128} />
              </Form.Item>
            </>
          )}

          <Form.Item
            name="amount"
            label="初始存款金额（元）"
            rules={[
              { required: true, message: '请输入初始存款金额' },
              { type: 'number', min: 0.01, message: '金额必须大于 0' },
            ]}
          >
            <MoneyInput />
          </Form.Item>

          <Button type="primary" onClick={toConfirm}>
            下一步
          </Button>
        </Form>
      )}

      {step === 1 && (
        <>
          <Descriptions bordered column={1} size="small" style={{ maxWidth: 600, marginBottom: 24 }} items={[
            { key: 'cust', label: '客户', children: customerDesc },
            { key: 'amount', label: '初始存款金额', children: `¥ ${fenToYuan(yuanToFen(values.amount ?? 0))}` },
          ]} />
          <Alert
            type="info"
            showIcon
            message="请核对客户证件与要素，确认无误后提交。"
            style={{ maxWidth: 600, marginBottom: 16 }}
          />
          <Flex gap={8}>
            <Button onClick={() => setStep(0)}>上一步</Button>
            <Button type="primary" loading={submitting} onClick={submit}>
              确认提交
            </Button>
          </Flex>
        </>
      )}

      <TxnResultModal result={result} onClose={() => setResult(null)} onNew={reset} />
    </Card>
  );
}
