import { useCallback, useEffect, useState } from 'react';
import { Card, Empty, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { getParams } from '../../api/admin';
import { fmtValue } from '../../utils/list';

interface ParamRow {
  [k: string]: unknown;
}

/** 参数查看：系统参数（对象或数组均兼容渲染） */
export default function Params() {
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getParams());
    } catch {
      /* 拦截器已提示 */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  let body;
  if (Array.isArray(data)) {
    const rows = data as ParamRow[];
    const keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r ?? {}))));
    const columns: ColumnsType<ParamRow> = keys.map((k) => ({
      title: k,
      dataIndex: k,
      render: (v: unknown) => fmtValue(v),
    }));
    body = (
      <Table<ParamRow>
        rowKey={(_, i) => String(i)}
        size="small"
        loading={loading}
        columns={columns}
        dataSource={rows}
        pagination={false}
      />
    );
  } else if (data && typeof data === 'object') {
    const rows = Object.entries(data as Record<string, unknown>).map(([k, v]) => ({ key: k, value: v }));
    const columns: ColumnsType<{ key: string; value: unknown }> = [
      { title: '参数', dataIndex: 'key' },
      { title: '值', dataIndex: 'value', render: (v: unknown) => fmtValue(v) },
    ];
    body = (
      <Table<{ key: string; value: unknown }>
        rowKey="key"
        size="small"
        loading={loading}
        columns={columns}
        dataSource={rows}
        pagination={false}
      />
    );
  } else {
    body = loading ? <Empty description="加载中…" /> : <Empty description="暂无参数数据" />;
  }

  return <Card title="系统参数">{body}</Card>;
}
