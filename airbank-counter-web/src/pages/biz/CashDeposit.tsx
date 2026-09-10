import { Input } from 'antd';
import SimpleTxn from '../../components/SimpleTxn';
import MoneyInput from '../../components/MoneyInput';
import { yuanToFen } from '../../utils/money';

/** 现金存款：账号 → 金额 → 备注，两步提交 */
export default function CashDeposit() {
  return (
    <SimpleTxn
      title="现金存款"
      description="录入账号与存款金额，核对后提交；大额存款将转入主管授权。"
      fields={[
        { key: 'acctNo', label: '账号 / 卡号', required: true, node: <Input placeholder="请输入账号或卡号" maxLength={32} /> },
        { key: 'amount', label: '存款金额（元）', required: true, isMoney: true, node: <MoneyInput /> },
        { key: 'remark', label: '备注', node: <Input.TextArea rows={2} placeholder="备注（选填）" maxLength={200} /> },
      ]}
      buildPayload={(v, requestNo) => ({
        bizType: 'CASH_DEPOSIT',
        requestNo,
        acctNo: String(v.acctNo ?? '').trim(),
        amount: yuanToFen(v.amount as number),
        remark: v.remark ? String(v.remark) : undefined,
      })}
    />
  );
}
