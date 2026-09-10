import { useCallback, useEffect, useState } from 'react';
import { Badge, Card, Empty, List, Pagination, Space, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { listMessages, markMessageRead } from '../api/ebank';
import type { MessageVO, MsgType } from '../api/types';

const PAGE_SIZE = 10;

const TYPE_META: Record<MsgType, { color: string; text: string }> = {
  OTP: { color: 'gold', text: '验证码' },
  TRADE: { color: 'blue', text: '交易通知' },
  BATCH: { color: 'purple', text: '批量通知' },
};

export default function MessagesPage() {
  const [list, setList] = useState<MessageVO[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const vo = await listMessages(page, PAGE_SIZE);
      setList(vo.list ?? []);
      setTotal(vo.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleClick = async (msg: MessageVO) => {
    if (!msg.isRead) {
      try {
        await markMessageRead(msg.id);
        setList((prev) => prev.map((m) => (m.id === msg.id ? { ...m, isRead: true } : m)));
      } catch {
        // 拦截器已提示
      }
    }
  };

  const unreadCount = list.filter((m) => !m.isRead).length;

  return (
    <Card
      title={
        <Space>
          <span>消息中心</span>
          {unreadCount > 0 && <Badge count={unreadCount} size="small" title={`${unreadCount} 条未读`} />}
        </Space>
      }
      extra={<Typography.Text type="secondary">点击消息即标记为已读</Typography.Text>}
    >
      <List<MessageVO>
        loading={loading}
        dataSource={list}
        locale={{ emptyText: <Empty description="暂无消息" /> }}
        pagination={false}
        renderItem={(msg) => {
          const meta = TYPE_META[msg.msgType as MsgType] ?? { color: 'default', text: msg.msgType };
          return (
            <List.Item
              style={{ cursor: 'pointer', opacity: msg.isRead ? 0.72 : 1 }}
              onClick={() => void handleClick(msg)}
              actions={[<Tag key="read">{msg.isRead ? '已读' : '未读'}</Tag>]}
            >
              <List.Item.Meta
                title={
                  <Space>
                    {!msg.isRead && <Badge status="processing" />}
                    <Typography.Text strong={!msg.isRead}>{msg.title}</Typography.Text>
                    <Tag color={meta.color}>{meta.text}</Tag>
                  </Space>
                }
                description={
                  <Space direction="vertical" size={2}>
                    <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content || '--'}</span>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {msg.createdAt ? dayjs(msg.createdAt).format('YYYY-MM-DD HH:mm:ss') : ''}
                    </Typography.Text>
                  </Space>
                }
              />
            </List.Item>
          );
        }}
      />
      <div style={{ textAlign: 'right', marginTop: 16 }}>
        <Pagination
          current={page}
          pageSize={PAGE_SIZE}
          total={total}
          showSizeChanger={false}
          showTotal={(t) => `共 ${t} 条`}
          onChange={(p) => setPage(p)}
        />
      </div>
    </Card>
  );
}
