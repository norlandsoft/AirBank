import { Typography } from 'antd';

/** 单号等关键信息：等宽展示 + 一键复制 */
export default function Copyable({ text }: { text?: string | number | null }) {
  if (text === undefined || text === null || text === '') {
    return <Typography.Text type="secondary">-</Typography.Text>;
  }
  return (
    <Typography.Text copyable={{ tooltips: ['复制', '已复制'] }} code>
      {String(text)}
    </Typography.Text>
  );
}
