import { Input } from 'antd';
import SimpleTxn from '../../components/SimpleTxn';
import MoneyInput from '../../components/MoneyInput';
import { yuanToFen } from '../../utils/money';

/** 行内转账：付款账号 → 收款账号 → 金额备注；大额授权 */
export default function Transfer() {
  return (
    <SimpleTxn
      title="行内转账"
      description="录入付款账号、收款账号与金额，核对后提交；大额转账需主管授权。"
      fields={[
        { key: 'acctNo', label: '付款账号', required: true, node: <Input placeholder="付款账号" maxLength={32} /> },
        { key: 'toAcct', label: '收款账号', required: true, node: <Input placeholder="收款账号" maxLength={32} /> },
        { key: 'amount', label: '转账金额（元）', required: true, isMoney: true, node: <MoneyInput /> },
        { key: 'remark', label: '附言 / 备注', node: <Input.TextArea rows={2} placeholder="附言（选填）" maxLength={200} /> },
      ]}
      buildPayload={(v, requestNo) => ({
        bizType: 'INNER_TRANSFER',
        requestNo,
        acctNo: String(v.acctNo ?? '').trim(),
        toAcct: String(v.toAcct ?? '').trim(),
        amount: yuanToFen(v.amount as number),
        remark: v.remark ? String(v.remark) : undefined,
      })}
    />
  );
}
