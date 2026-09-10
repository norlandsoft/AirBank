import { Tag } from 'antd';

/** 状态 → 颜色/文案映射（docs/design/10 约定：SUCCESS 绿 / CONFIRMED 蓝 / REDEEMING 橙 / 失败红） */
const STATUS_META: Record<string, { color: string; text: string }> = {
  // 通用
  SUCCESS: { color: 'green', text: '成功' },
  FAILED: { color: 'red', text: '失败' },
  INIT: { color: 'default', text: '已受理' },
  // 理财订单
  PAYING: { color: 'blue', text: '支付中' },
  PAY_SUCCESS: { color: 'green', text: '支付成功' },
  PAY_FAILED: { color: 'red', text: '支付失败' },
  CONFIRMED: { color: 'blue', text: '已确认' },
  REDEEMING: { color: 'orange', text: '赎回中' },
  SETTLED: { color: 'green', text: '已清算' },
  REFUNDING: { color: 'orange', text: '退款中' },
  REFUNDED: { color: 'default', text: '已退款' },
  // 产品
  ON_SALE: { color: 'green', text: '在售' },
  OFF_SALE: { color: 'default', text: '停售' },
  SOLD_OUT: { color: 'orange', text: '售罄' },
  RUNNING: { color: 'blue', text: '存续期' },
  SETTLING: { color: 'orange', text: '清算中' },
  CLOSED: { color: 'default', text: '已结清' },
  // 账户 / 存单
  ACTIVE: { color: 'green', text: '正常' },
  FROZEN: { color: 'red', text: '冻结' },
  INACTIVE: { color: 'default', text: '未激活' },
  HOLDING: { color: 'blue', text: '持有中' },
  MATURED_PAID: { color: 'green', text: '已到期兑付' },
  BROKEN_EARLY: { color: 'orange', text: '提前支取' },
  // 网银流水
  POSTED: { color: 'green', text: '已入账' },
};

export default function StatusBadge({ status }: { status?: string | null }) {
  if (!status) return <span>--</span>;
  const meta = STATUS_META[status] ?? { color: 'default', text: status };
  return <Tag color={meta.color}>{meta.text}</Tag>;
}
