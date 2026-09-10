import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Empty, Input, Row, Select, Tabs, Tag, Typography } from 'antd';
import { getWealthProducts, submitTxn } from '../../api/counter';
import { newRequestNo } from '../../api/http';
import type { TxnPayload, WealthProduct } from '../../api/types';
import SimpleTxn from '../../components/SimpleTxn';
import MoneyInput from '../../components/MoneyInput';
import { RISK_COLORS } from '../../utils/dict';
import { asList, fmtValue } from '../../utils/list';
import { fenToYuan, yuanToFen } from '../../utils/money';

/** 理财代销：产品卡列表 → 申购 / 赎回 */
export default function Wealth() {
  const [products, setProducts] = useState<WealthProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('subscribe');
  const [selected, setSelected] = useState<WealthProduct | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setProducts(asList(await getWealthProducts()));
    } catch {
      /* 拦截器已提示 */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const termText = (p: WealthProduct) =>
    p.termDays !== undefined && p.termDays !== null && p.termDays !== ''
      ? `${p.termDays} 天`
      : p.termMonths !== undefined && p.termMonths !== null && p.termMonths !== ''
        ? `${p.termMonths} 个月`
        : '-';

  return (
    <Card title="理财代销">
      <p style={{ color: 'rgba(0,0,0,0.45)', marginTop: 0 }}>
        选择产品后办理申购 / 赎回；客户风险等级须不低于产品风险等级（C1–C5 对应 R1–R5）。
      </p>
      <Row gutter={[16, 16]} style={{ marginBottom: 8 }}>
        {products.length === 0 && !loading && (
          <Col span={24}>
            <Empty description="暂无在售理财产品" />
          </Col>
        )}
        {products.map((p) => {
          const active = !!selected?.productCode && selected.productCode === p.productCode;
          return (
            <Col key={String(p.productCode ?? Math.random())} xs={24} sm={12} md={8} lg={6}>
              <Card
                size="small"
                hoverable
                style={active ? { borderColor: '#1B4D92', borderWidth: 2 } : undefined}
                title={
                  <span>
                    {fmtValue(p.productName)}{' '}
                    {p.riskLevel ? <Tag color={RISK_COLORS[p.riskLevel] ?? 'default'}>{p.riskLevel}</Tag> : null}
                  </span>
                }
                extra={<Typography.Text code>{fmtValue(p.productCode)}</Typography.Text>}
              >
                <p style={{ marginBottom: 4 }}>
                  业绩基准：<b style={{ color: '#d46b08' }}>{fmtValue(p.annualRate)}%</b>
                </p>
                <p style={{ marginBottom: 4 }}>期限：{termText(p)}</p>
                <p style={{ marginBottom: 12 }}>起购：¥ {fenToYuan(p.minAmount as string | number)}</p>
                <Button
                  type="primary"
                  size="small"
                  onClick={() => {
                    setSelected(p);
                    setTab('subscribe');
                  }}
                >
                  申购此产品
                </Button>
              </Card>
            </Col>
          );
        })}
      </Row>

      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          { key: 'subscribe', label: '申购', children: <Subscribe product={selected} /> },
          { key: 'redeem', label: '赎回', children: <Redeem products={products} /> },
        ]}
      />
    </Card>
  );
}

function Subscribe({ product }: { product: WealthProduct | null }) {
  if (!product) {
    return <Empty description="请先在上方选择理财产品" />;
  }
  return (
    <>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16, maxWidth: 620 }}
        message={`已选产品：${fmtValue(product.productName)}（${fmtValue(product.productCode)} · ${fmtValue(product.riskLevel)}）`}
      />
      <SimpleTxn
        key={`sub-${String(product.productCode)}`}
        title="理财申购"
        fields={[
          { key: 'customerId', label: '客户号', required: true, node: <Input placeholder="请输入客户号" maxLength={32} /> },
          { key: 'acctNo', label: '扣款账号', required: true, node: <Input placeholder="请输入扣款账号" maxLength={32} /> },
          { key: 'amount', label: '申购金额（元）', required: true, isMoney: true, node: <MoneyInput /> },
        ]}
        buildPayload={(v, requestNo): TxnPayload => ({
          bizType: 'WEALTH_SUBSCRIBE',
          requestNo,
          productCode: String(product.productCode ?? ''),
          customerId: String(v.customerId ?? '').trim(),
          acctNo: String(v.acctNo ?? '').trim(),
          amount: yuanToFen(v.amount as number),
        })}
      />
    </>
  );
}

function Redeem({ products }: { products: WealthProduct[] }) {
  return (
    <SimpleTxn
      title="理财赎回"
      description="输入持有产品对应信息；赎回份额 = 录入的份额数量。"
      fields={[
        { key: 'customerId', label: '客户号', required: true, node: <Input placeholder="请输入客户号" maxLength={32} /> },
        {
          key: 'productCode',
          label: '产品代码',
          required: true,
          node: (
            <Select
              showSearch
              placeholder="请选择产品"
              style={{ width: 300 }}
              options={products.map((p) => ({
                value: String(p.productCode),
                label: `${fmtValue(p.productName)}（${fmtValue(p.productCode)}）`,
              }))}
            />
          ),
          labelFor: (v) => String(products.find((p) => String(p.productCode) === String(v))?.productName ?? v),
        },
        { key: 'shares', label: '赎回份额（份）', required: true, isMoney: true, node: <MoneyInput placeholder="请输入赎回份额" /> },
      ]}
      buildPayload={(v, requestNo): TxnPayload => ({
        bizType: 'WEALTH_REDEEM',
        requestNo,
        customerId: String(v.customerId ?? '').trim(),
        productCode: String(v.productCode ?? ''),
        shares: yuanToFen(v.shares as number),
      })}
    />
  );
}
