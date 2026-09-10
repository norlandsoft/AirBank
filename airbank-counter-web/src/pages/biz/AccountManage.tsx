import { Input, Select } from 'antd';
import SimpleTxn from '../../components/SimpleTxn';
import MoneyInput from '../../components/MoneyInput';
import { yuanToFen } from '../../utils/money';

const ACTION_OPTIONS = [
  { value: 'FREEZE', label: '冻结' },
  { value: 'UNFREEZE', label: '解冻' },
  { value: 'STOP_PAYMENT', label: '止付' },
  { value: 'RESUME_PAYMENT', label: '解除止付' },
  { value: 'CLOSE', label: '销户' },
];

const ACTION_BIZ_TYPE: Record<string, string> = {
  FREEZE: 'ACCOUNT_FREEZE',
  UNFREEZE: 'ACCOUNT_UNFREEZE',
  STOP_PAYMENT: 'ACCOUNT_STOP_PAYMENT',
  RESUME_PAYMENT: 'ACCOUNT_RESUME_PAYMENT',
  CLOSE: 'ACCOUNT_CLOSE',
};

/** 账户管理：冻结 / 解冻 / 止付 / 解除止付 / 销户（一律需主管复核） */
export default function AccountManage() {
  return (
    <SimpleTxn
      title="账户管理（冻结 / 解冻 / 止付 / 销户）"
      description="账户管理类操作一律需主管复核授权；请务必填写原因以便留痕。"
      fields={[
        { key: 'acctNo', label: '账号', required: true, node: <Input placeholder="请输入账号" maxLength={32} /> },
        {
          key: 'action',
          label: '操作类型',
          required: true,
          node: <Select options={ACTION_OPTIONS} placeholder="请选择操作" style={{ width: 220 }} />,
          labelFor: (v) => ACTION_OPTIONS.find((o) => o.value === v)?.label ?? String(v),
        },
        { key: 'reason', label: '原因', required: true, node: <Input.TextArea rows={2} placeholder="请输入业务原因（必填）" maxLength={200} /> },
      ]}
      buildPayload={(v, requestNo) => {
        const action = String(v.action ?? '');
        return {
          bizType: ACTION_BIZ_TYPE[action] ?? `ACCOUNT_${action}`,
          requestNo,
          acctNo: String(v.acctNo ?? '').trim(),
          reason: String(v.reason ?? ''),
        };
      }}
    />
  );
}
