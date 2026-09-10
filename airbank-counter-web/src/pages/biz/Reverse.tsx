import { Input } from 'antd';
import SimpleTxn from '../../components/SimpleTxn';

/** 当日冲正：按原核心流水号发起反向冲正（备注必填，需授权） */
export default function Reverse() {
  return (
    <SimpleTxn
      title="当日冲正"
      description="仅支持冲正本人当日已入账交易；冲正为反向账务动作，需主管授权。"
      fields={[
        { key: 'txnNo', label: '原核心流水号 txnNo', required: true, node: <Input placeholder="请输入原交易的核心流水号" maxLength={40} /> },
        { key: 'remark', label: '冲正原因（备注）', required: true, node: <Input.TextArea rows={2} placeholder="冲正原因必填" maxLength={200} /> },
      ]}
      buildPayload={(v, requestNo) => ({
        bizType: 'REVERSE',
        requestNo,
        txnNo: String(v.txnNo ?? '').trim(),
        remark: String(v.remark ?? ''),
      })}
    />
  );
}
