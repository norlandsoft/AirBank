import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Input, message, Modal, Popconfirm, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined } from '@ant-design/icons';
import { approveReview, getPendingReviews, rejectReview } from '../api/counter';
import type { ReviewItem } from '../api/types';
import { bizTypeLabel } from '../utils/dict';
import { asList, fmtValue } from '../utils/list';
import { fenToYuan } from '../utils/money';

/** 待复核授权：队列 + 通过 / 驳回（SUPERVISOR） */
export default function Review() {
  const [list, setList] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<ReviewItem | null>(null);
  const [comment, setComment] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setList(asList<ReviewItem>(await getPendingReviews()));
    } catch {
      /* 拦截器已提示 */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rid = (r: ReviewItem) => String(r.id ?? r.ctNo ?? '');

  const doApprove = async (r: ReviewItem) => {
    setActingId(rid(r));
    try {
      await approveReview(r.id ?? r.ctNo!);
      message.success(`已通过授权：${r.ctNo ?? ''}`);
      await load();
    } catch {
      /* 拦截器已提示 */
    } finally {
      setActingId(null);
    }
  };

  const openReject = (r: ReviewItem) => {
    setRejecting(r);
    setComment('');
  };

  const doReject = async () => {
    if (!rejecting) return;
    if (!comment.trim()) {
      message.warning('请填写驳回意见');
      return;
    }
    setRejectingId(rid(rejecting));
    try {
      await rejectReview(rejecting.id ?? rejecting.ctNo!, comment.trim());
      message.success(`已驳回：${rejecting.ctNo ?? ''}`);
      setRejecting(null);
      await load();
    } catch {
      /* 拦截器已提示 */
    } finally {
      setRejectingId(null);
    }
  };

  const columns: ColumnsType<ReviewItem> = [
    { title: '申请单号', dataIndex: 'ctNo', render: (v: unknown) => fmtValue(v) },
    { title: '业务类型', dataIndex: 'bizType', render: (v: string) => bizTypeLabel(v) },
    { title: '金额（元）', dataIndex: 'amount', align: 'right', render: (v: unknown) => fenToYuan(v as string | number) },
    { title: '受理柜员', render: (_, r) => r.tellerName || r.tellerNo || '-' },
    { title: '申请时间', dataIndex: 'createdAt', render: (v: unknown) => fmtValue(v) },
    { title: '状态', dataIndex: 'status', render: (v: string) => (v ? <Tag color="processing">{v}</Tag> : '-') },
    {
      title: '操作',
      render: (_, r) => (
        <>
          <Popconfirm title="确认通过该笔授权？通过后系统自动执行。" onConfirm={() => void doApprove(r)}>
            <Button type="link" size="small" loading={actingId === rid(r)}>
              通过
            </Button>
          </Popconfirm>
          <Button type="link" size="small" danger onClick={() => openReject(r)}>
            驳回
          </Button>
        </>
      ),
    },
  ];

  return (
    <Card
      title="待复核授权"
      extra={
        <Button icon={<ReloadOutlined />} size="small" onClick={() => void load()} loading={loading}>
          刷新
        </Button>
      }
    >
      <Table<ReviewItem>
        rowKey={(r) => rid(r) || String(Math.random())}
        size="small"
        loading={loading}
        columns={columns}
        dataSource={list}
        pagination={false}
      />
      <Modal
        open={!!rejecting}
        title={`驳回授权：${rejecting?.ctNo ?? ''}`}
        onCancel={() => setRejecting(null)}
        onOk={doReject}
        okText="确认驳回"
        okButtonProps={{ danger: true, loading: !!rejectingId }}
        destroyOnClose
      >
        <Input.TextArea
          rows={3}
          maxLength={200}
          placeholder="请填写驳回意见（必填）"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </Modal>
    </Card>
  );
}
