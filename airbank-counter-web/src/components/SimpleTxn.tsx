import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Card, Descriptions, Form, Space, Steps, message } from 'antd';
import { submitTxn } from '../api/counter';
import { newRequestNo } from '../api/http';
import type { TxnPayload, TxnResult } from '../api/types';
import MoneyInput from './MoneyInput';
import TxnResultModal from './TxnResultModal';
import { fenToYuan, yuanToFen } from '../utils/money';

export interface SimpleTxnField {
  key: string;
  label: string;
  required?: boolean;
  /** 表单控件 */
  node: ReactNode;
  /** 金额字段（录入元、提交分、确认页千分位展示） */
  isMoney?: boolean;
  /** 确认页展示转换（如 Select 值转文字） */
  labelFor?: (v: unknown) => string;
  hint?: string;
}

interface Props {
  title: string;
  description?: string;
  fields: SimpleTxnField[];
  /** 由页面决定最终报文（含 bizType 与金额分转换） */
  buildPayload: (values: Record<string, unknown>, requestNo: string) => TxnPayload;
  onSubmitted?: () => void;
}

/**
 * 通用"两步式"交易页：录入要素 → 确认提交。
 * 金额必填校验 + 提交按钮 loading 防重复 + 统一结果弹窗。
 */
export default function SimpleTxn({ title, description, fields, buildPayload, onSubmitted }: Props) {
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
      /* 校验失败，antd 已标红 */
    }
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await submitTxn(buildPayload(values, newRequestNo()));
      setResult(res);
      if (res?.status === 'PENDING_REVIEW') {
        message.success('已提交待主管授权');
      }
      onSubmitted?.();
    } catch {
      /* 拦截器已统一提示 */
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

  const renderValue = (v: unknown, f: SimpleTxnField): ReactNode => {
    if (v === undefined || v === null || v === '') return '-';
    if (f.labelFor) return f.labelFor(v);
    if (f.isMoney) return `¥ ${fenToYuan(yuanToFen(v as string | number))}`;
    return String(v);
  };

  return (
    <Card title={title}>
      {description && <p style={{ color: 'rgba(0,0,0,0.45)', marginTop: 0 }}>{description}</p>}
      <Steps
        size="small"
        current={step}
        items={[{ title: '录入要素' }, { title: '确认提交' }]}
        style={{ maxWidth: 460, marginBottom: 24 }}
      />
      {step === 0 && (
        <Form form={form} layout="vertical" style={{ maxWidth: 520 }}>
          {fields.map((f) => (
            <Form.Item
              key={f.key}
              name={f.key}
              label={f.label}
              extra={f.hint}
              rules={f.required ? [{ required: true, message: `请输入${f.label}` }] : undefined}
            >
              {f.node}
            </Form.Item>
          ))}
          <Button type="primary" onClick={toConfirm}>
            下一步
          </Button>
        </Form>
      )}
      {step === 1 && (
        <>
          <Descriptions
            bordered
            column={1}
            size="small"
            style={{ maxWidth: 560, marginBottom: 24 }}
            items={fields.map((f) => ({
              key: f.key,
              label: f.label,
              children: renderValue(values[f.key], f),
            }))}
          />
          <Space>
            <Button onClick={() => setStep(0)}>上一步</Button>
            <Button type="primary" loading={submitting} onClick={submit}>
              确认提交
            </Button>
          </Space>
        </>
      )}
      <TxnResultModal result={result} onClose={() => setResult(null)} onNew={reset} />
    </Card>
  );
}

export { MoneyInput };
