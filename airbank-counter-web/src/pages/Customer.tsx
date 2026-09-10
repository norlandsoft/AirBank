import { useState } from 'react';
import { Card, Col, Empty, Input, message, Row, Spin, Tag, Typography } from 'antd';
import { searchCustomers } from '../api/counter';
import type { CustomerVO } from '../api/types';
import { RISK_COLORS } from '../utils/dict';
import { asList, fmtValue } from '../utils/list';

/** 客户查询：客户号 / 证件号 → 客户卡 */
export default function Customer() {
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [list, setList] = useState<CustomerVO[]>([]);

  const doSearch = async () => {
    if (!keyword.trim()) {
      message.warning('请输入客户号或证件号');
      return;
    }
    setLoading(true);
    try {
      setList(asList<CustomerVO>(await searchCustomers(keyword.trim())));
      setSearched(true);
    } catch {
      /* 拦截器已提示 */
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="客户查询">
      <Input.Search
        style={{ maxWidth: 460, marginBottom: 24 }}
        placeholder="请输入客户号或证件号"
        enterButton="查询"
        value={keyword}
        maxLength={32}
        onChange={(e) => setKeyword(e.target.value)}
        onSearch={() => void doSearch()}
        loading={loading}
      />
      {loading ? (
        <Spin />
      ) : list.length === 0 ? (
        <Empty description={searched ? '未查询到客户' : '输入客户号或证件号后查询'} />
      ) : (
        <Row gutter={[16, 16]}>
          {list.map((c, i) => (
            <Col key={String(c.customerNo ?? c.customerId ?? i)} xs={24} sm={12} md={8} lg={6}>
              <Card size="small" title={fmtValue(c.name ?? c.customerName)}>
                <p style={{ marginBottom: 4 }}>
                  客户号：
                  <Typography.Text code>{fmtValue(c.customerNo ?? c.customerId)}</Typography.Text>
                </p>
                <p style={{ marginBottom: 4 }}>证件号：{fmtValue(c.idNoMask)}</p>
                <p style={{ marginBottom: 4 }}>手机号：{fmtValue(c.mobileMask)}</p>
                <p style={{ marginBottom: 0 }}>
                  风险等级：{c.riskLevel ? <Tag color={RISK_COLORS[c.riskLevel] ?? 'default'}>{c.riskLevel}</Tag> : '-'}
                </p>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </Card>
  );
}
