import { Input } from 'antd';
import SimpleTxn from '../../components/SimpleTxn';
import MoneyInput from '../../components/MoneyInput';
import { yuanToFen } from '../../utils/money';

/** 现金取款：账号 → 金额 → 备注；校验尾箱余额，大额需主管授权 */
export default function CashWithdraw() {
  return (
      <SimpleTxn
      title="现金取款"
      description="取款金额不得超过尾箱余额；单笔 5 万元（含）以上需主管授权。"
      fields={[
        { key: 'acctNo', label: '账号 / 卡号', required: true, node: <Input placeholder="请输入账号或卡号" maxLength={32} /> },
        { key: 'amount', label: '取款金额（元）', required: true, isMoney: true, node: <MoneyInput /> },
        { key: 'remark', label: '备注', node: <Input.TextArea rows={2} placeholder="备注（选填）" maxLength={200} /> },
      ]}
      buildPayload={(v, requestNo) => ({
        bizType: 'CASH_WITHDRAW',
        requestNo,
        acctNo: String(v.acctNo ?? '').trim(),
        amount: yuanToFen(v.amount as number),
        remark: v.remark ? String(v.remark) : undefined,
      })}
    />
  );
}
