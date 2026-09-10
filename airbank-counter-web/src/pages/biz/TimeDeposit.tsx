import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Descriptions, Empty, Form, Input, message, Select, Space, Steps, Table, Tabs, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { getTimeDeposits, submitTxn } from '../../api/counter';
import { newRequestNo } from '../../api/http';
import type { TimeDepositVO, TxnResult } from '../../api/types';
import MoneyInput from '../../components/MoneyInput';
import TxnResultModal from '../../components/TxnResultModal';
import { bizTypeLabel } from '../../utils/dict';
import { asList, fmtValue } from '../../utils/list';
import { fenToYuan, yuanToFen } from '../../utils/money';

const TERM_OPTIONS = [3, 6, 12, 24, 36].map((m) => ({ value: m, label: `${m} 个月` }));

function depositStatusTag(status?: string) {
  if (!status) return '-';
  const map: Record<string, { color: string; text: string }> = {
    ACTIVE: { color: 'processing', text: '存续中' },
    BROKEN_EARLY: { color: 'orange', text: '提前支取' },
    MATURED: { color: 'green', text: '已到期' },
    CLOSED: { color: 'default', text: '已结清' },
  };
  const hit = map[status];
  return hit ? <Tag color={hit.color}>{hit.text}</Tag> : <Tag>{status}</Tag>;
}

/** 定期业务：Tab1 存入（TIME_DEPOSIT_IN）/ Tab2 支取（TIME_DEPOSIT_BREAK，含存单列表） */
export default function TimeDeposit() {
  return (
    <Card title="定期业务">
      <Tabs
        defaultActiveKey="in"
        items={[
          { key: 'in', label: '定期存入', children: <DepositIn /> },
          { key: 'break', label: '定期支取', children: <DepositBreak /> },
        ]}
      />
    </Card>
  );
}

function DepositIn() {
  const [form] = Form.useForm<Record<string, unknown>>();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [values, setValues] = useState<Record<string, unknown>>({});
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
      const res = await submitTxn({
        bizType: 'TIME_DEPOSIT_IN',
        requestNo: newRequestNo(),
        acctNo: String(values.acctNo ?? '').trim(),
        termMonths: Number(values.termMonths ?? 12),
        amount: yuanToFen(values.amount as number),
      });
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

  return (
    <>
      <p style={{ color: 'rgba(0,0,0,0.45)', marginTop: 0 }}>活期转定期；提前支取将按活期利率计息，存在利率损失。</p>
      <Steps size="small" current={step} items={[{ title: '录入要素' }, { title: '确认提交' }]} style={{ maxWidth: 460, marginBottom: 24 }} />
      {step === 0 && (
        <Form form={form} layout="vertical" style={{ maxWidth: 520 }}>
          <Form.Item name="acctNo" label="付款账号（活期）" rules={[{ required: true, message: '请输入账号' }]}>
            <Input placeholder="请输入活期账号" maxLength={32} />
          </Form.Item>
          <Form.Item name="termMonths" label="存期" rules={[{ required: true, message: '请选择存期' }]}>
            <Select options={TERM_OPTIONS} placeholder="请选择存期" style={{ width: 220 }} />
          </Form.Item>
          <Form.Item name="amount" label="存入金额（元）" rules={[{ required: true, message: '请输入存入金额' }]}>
            <MoneyInput />
          </Form.Item>
          <Button type="primary" onClick={toConfirm}>
            下一步
          </Button>
        </Form>
      )}
      {step === 1 && (
        <>
          <Descriptions bordered column={1} size="small" style={{ maxWidth: 560, marginBottom: 24 }} items={[
            { key: 'acctNo', label: '付款账号', children: fmtValue(values.acctNo) },
            { key: 'term', label: '存期', children: `${values.termMonths} 个月` },
            { key: 'amount', label: '存入金额', children: `¥ ${fenToYuan(yuanToFen(values.amount as number))}` },
          ]} />
          <Space>
            <Button onClick={() => setStep(0)}>上一步</Button>
            <Button type="primary" loading={submitting} onClick={submit}>
              确认提交
            </Button>
          </Space>
        </>
      )}
      <TxnResultModal result={result} onClose={() => setResult(null)} onNew={reset} />
    </>
  );
}

function DepositBreak() {
  const [form] = Form.useForm<Record<string, unknown>>();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [result, setResult] = useState<TxnResult | null>(null);

  const [queryAcct, setQueryAcct] = useState('');
  const [list, setList] = useState<TimeDepositVO[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [selected, setSelected] = useState<string>();

  const loadList = useCallback(async (acctNo: string) => {
    if (!acctNo.trim()) {
      message.warning('请输入账号后查询存单');
      return;
    }
    setLoadingList(true);
    try {
      setList(asList(await getTimeDeposits(acctNo.trim())));
    } catch {
      /* 拦截器已提示 */
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    if (selected) form.setFieldValue('depositNo', selected);
  }, [selected, form]);

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
      const res = await submitTxn({
        bizType: 'TIME_DEPOSIT_BREAK',
        requestNo: newRequestNo(),
        depositNo: String(values.depositNo ?? '').trim(),
      });
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
    setSelected(undefined);
  };

  const columns: ColumnsType<TimeDepositVO> = [
    { title: '存单号', dataIndex: 'depositNo', render: (v: unknown) => fmtValue(v) },
    { title: '账号', dataIndex: 'acctNo', render: (v: unknown) => fmtValue(v) },
    { title: '存期', dataIndex: 'termMonths', render: (v: unknown) => (v === undefined || v === null || v === '' ? '-' : `${v} 个月`) },
    { title: '金额（元）', dataIndex: 'amount', align: 'right', render: (v: unknown) => fenToYuan(v as string | number) },
    { title: '利率', dataIndex: 'rate', render: (v: unknown) => (v === undefined || v === null || v === '' ? '-' : `${v}%`) },
    { title: '起息日', dataIndex: 'valueDate', render: (v: unknown) => fmtValue(v) },
    { title: '到期日', dataIndex: 'maturityDate', render: (v: unknown) => fmtValue(v) },
    { title: '状态', dataIndex: 'status', render: (v: string) => depositStatusTag(v) },
  ];

  return (
    <>
      <p style={{ color: 'rgba(0,0,0,0.45)', marginTop: 0 }}>提前支取按活期利率计息，存在利率损失；到期支取按存单利率计息。</p>
      <Steps size="small" current={step} items={[{ title: '选择存单' }, { title: '确认提交' }]} style={{ maxWidth: 460, marginBottom: 24 }} />

      {step === 0 && (
        <>
          <Space style={{ marginBottom: 16 }} size="small">
            <Input
              style={{ width: 300 }}
              placeholder="请输入账号查询名下存单"
              value={queryAcct}
              maxLength={32}
              onChange={(e) => setQueryAcct(e.target.value)}
              onPressEnter={() => void loadList(queryAcct)}
            />
            <Button type="primary" ghost loading={loadingList} onClick={() => void loadList(queryAcct)}>
              查询存单
            </Button>
          </Space>
          <Table<TimeDepositVO>
            rowKey={(r) => String(r.depositNo ?? r.acctNo ?? Math.random())}
            size="small"
            loading={loadingList}
            columns={columns}
            dataSource={list}
            pagination={false}
            locale={{ emptyText: <Empty description="暂无存单，请先按账号查询" /> }}
            rowSelection={{
              type: 'radio',
              selectedRowKeys: selected ? [selected] : [],
              onChange: (keys) => setSelected(keys.length ? String(keys[0]) : undefined),
            }}
            style={{ marginBottom: 24 }}
          />
          <Form form={form} layout="vertical" style={{ maxWidth: 520 }}>
            <Form.Item name="depositNo" label="存单号 depositNo" rules={[{ required: true, message: '请选择或输入存单号' }]}>
              <Input placeholder="可点击上方列表选择，或直接输入存单号" maxLength={40} />
            </Form.Item>
            <Button type="primary" onClick={toConfirm}>
              下一步
            </Button>
          </Form>
        </>
      )}

      {step === 1 && (
        <>
          <Descriptions bordered column={1} size="small" style={{ maxWidth: 560, marginBottom: 24 }} items={[
            { key: 'depositNo', label: '存单号', children: fmtValue(values.depositNo) },
            { key: 'biz', label: '业务类型', children: bizTypeLabel('TIME_DEPOSIT_BREAK') },
          ]} />
          <Space>
            <Button onClick={() => setStep(0)}>上一步</Button>
            <Button type="primary" danger loading={submitting} onClick={submit}>
              确认支取
            </Button>
          </Space>
        </>
      )}
      <TxnResultModal result={result} onClose={() => setResult(null)} onNew={reset} />
    </>
  );
}
