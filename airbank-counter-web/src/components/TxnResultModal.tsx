import { Button, Descriptions, Modal, Result, Typography } from 'antd';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { TxnResult } from '../api/types';
import Copyable from './Copyable';
import { fenToYuan } from '../utils/money';

interface Props {
  result: TxnResult | null;
  onClose: () => void;
  /** 关闭后"再办一笔"（重置表单回到第一步） */
  onNew?: () => void;
}

/**
 * 统一交易结果弹窗：
 * - status === 'POSTED'：成功结果，展示 ctNo / txnNo / 回执链接；
 * - status === 'PENDING_REVIEW'：提示"已提交待主管授权"。
 */
export default function TxnResultModal({ result, onClose, onNew }: Props) {
  const navigate = useNavigate();
  if (!result) return null;
  const pending = result.status === 'PENDING_REVIEW';

  const items: { key: string; label: string; children: ReactNode }[] = [];
  if (result.ctNo) items.push({ key: 'ctNo', label: '申请单号 ctNo', children: <Copyable text={result.ctNo} /> });
  if (result.txnNo) items.push({ key: 'txnNo', label: '核心流水号 txnNo', children: <Copyable text={result.txnNo} /> });
  if (result.acctNo) items.push({ key: 'acctNo', label: '账号', children: <Copyable text={result.acctNo} /> });
  if (result.cardNo) items.push({ key: 'cardNo', label: '卡号', children: <Copyable text={result.cardNo} /> });
  if (result.amount !== undefined && result.amount !== null && result.amount !== '') {
    items.push({ key: 'amount', label: '金额', children: `¥ ${fenToYuan(result.amount as string | number)}` });
  }
  items.push({
    key: 'status',
    label: '交易状态',
    children: (
      <Typography.Text type={pending ? 'warning' : 'success'} strong>
        {result.status ?? '-'}
      </Typography.Text>
    ),
  });

  return (
    <Modal
      open
      onCancel={onClose}
      title={pending ? '交易受理结果' : '交易办理成功'}
      footer={[
        <Button key="close" onClick={onClose}>
          关闭
        </Button>,
        ...(onNew
          ? [
              <Button key="new" type="primary" onClick={onNew}>
                再办一笔
              </Button>,
            ]
          : []),
      ]}
    >
      <Result
        status={pending ? 'info' : 'success'}
        title={pending ? '已提交待主管授权' : '交易成功'}
        subTitle={pending ? '该业务需主管复核授权，授权通过后系统自动执行入账' : undefined}
        style={{ padding: '8px 0' }}
      />
      <Descriptions bordered column={1} size="small" items={items} />
      {!pending && (
        <Button
          type="link"
          style={{ padding: 0, marginTop: 8 }}
          onClick={() => {
            onClose();
            navigate('/vouchers');
          }}
        >
          查看回执 →
        </Button>
      )}
    </Modal>
  );
}
