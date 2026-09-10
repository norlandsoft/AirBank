import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Form, Input, message, Modal, Select, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined } from '@ant-design/icons';
import { createTeller, listTellers, resetTellerPassword } from '../../api/admin';
import type { TellerVO } from '../../api/types';
import { tellerStatusTag } from '../../utils/dict';
import { asList, fmtValue } from '../../utils/list';

interface CreateForm {
  tellerNo: string;
  realName: string;
  branchNo: string;
  roleCode: string;
  password: string;
}

/** 柜员管理：列表 / 新增 / 重置密码（用户中心） */
export default function Tellers() {
  const [list, setList] = useState<TellerVO[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [resetTarget, setResetTarget] = useState<TellerVO | null>(null);
  const [resetting, setResetting] = useState(false);
  const [createForm] = Form.useForm<CreateForm>();
  const [resetForm] = Form.useForm<{ password: string }>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setList(asList<TellerVO>(await listTellers()));
    } catch {
      /* 拦截器已提示 */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const doCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setCreating(true);
      try {
        await createTeller(values);
        message.success(`柜员 ${values.tellerNo} 创建成功`);
        setCreateOpen(false);
        createForm.resetFields();
        await load();
      } catch {
        /* 拦截器已提示 */
      } finally {
        setCreating(false);
      }
    } catch {
      /* 校验失败 */
    }
  };

  const doReset = async () => {
    if (!resetTarget) return;
    try {
      const { password } = await resetForm.validateFields();
      setResetting(true);
      try {
        await resetTellerPassword(resetTarget.id ?? resetTarget.tellerNo!, password);
        message.success(`柜员 ${fmtValue(resetTarget.tellerNo)} 密码已重置`);
        setResetTarget(null);
        resetForm.resetFields();
      } catch {
        /* 拦截器已提示 */
      } finally {
        setResetting(false);
      }
    } catch {
      /* 校验失败 */
    }
  };

  const columns: ColumnsType<TellerVO> = [
    { title: '工号', dataIndex: 'tellerNo', render: (v: unknown) => fmtValue(v) },
    { title: '姓名', dataIndex: 'realName', render: (v: unknown) => fmtValue(v) },
    { title: '机构号', dataIndex: 'branchNo', render: (v: unknown) => fmtValue(v) },
    {
      title: '角色',
      dataIndex: 'roleCode',
      render: (v: string) =>
        v ? <Tag color={v === 'SUPERVISOR' ? 'gold' : 'blue'}>{v === 'SUPERVISOR' ? '主管' : '柜员'}</Tag> : '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (v: string) => {
        const s = tellerStatusTag(v);
        return <Tag color={s.color}>{s.label}</Tag>;
      },
    },
    {
      title: '操作',
      render: (_, r) => (
        <Button type="link" size="small" onClick={() => setResetTarget(r)}>
          重置密码
        </Button>
      ),
    },
  ];

  return (
    <Card
      title="柜员管理"
      extra={
        <Button type="primary" icon={<PlusOutlined />} size="small" onClick={() => setCreateOpen(true)}>
          新增柜员
        </Button>
      }
    >
      <Table<TellerVO>
        rowKey={(r) => String(r.id ?? r.tellerNo ?? Math.random())}
        size="small"
        loading={loading}
        columns={columns}
        dataSource={list}
        pagination={false}
      />

      <Modal
        open={createOpen}
        title="新增柜员"
        onCancel={() => setCreateOpen(false)}
        onOk={doCreate}
        confirmLoading={creating}
        okText="创建"
        destroyOnClose
      >
        <Form<CreateForm> form={createForm} layout="vertical" requiredMark>
          <Form.Item name="tellerNo" label="工号" rules={[{ required: true, message: '请输入工号' }]}>
            <Input placeholder="如 990003" maxLength={16} />
          </Form.Item>
          <Form.Item name="realName" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input placeholder="柜员姓名" maxLength={32} />
          </Form.Item>
          <Form.Item name="branchNo" label="机构号" rules={[{ required: true, message: '请输入机构号' }]}>
            <Input placeholder="如 0999" maxLength={16} />
          </Form.Item>
          <Form.Item name="roleCode" label="角色" rules={[{ required: true, message: '请选择角色' }]}>
            <Select
              placeholder="请选择角色"
              options={[
                { value: 'TELLER', label: '柜员' },
                { value: 'SUPERVISOR', label: '主管' },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="password"
            label="初始密码"
            rules={[
              { required: true, message: '请输入初始密码' },
              { min: 8, message: '密码至少 8 位' },
            ]}
          >
            <Input.Password placeholder="至少 8 位，含大小写字母与数字" maxLength={32} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={!!resetTarget}
        title={`重置密码：${fmtValue(resetTarget?.tellerNo)}（${fmtValue(resetTarget?.realName)}）`}
        onCancel={() => setResetTarget(null)}
        onOk={doReset}
        confirmLoading={resetting}
        okText="重置"
        destroyOnClose
      >
        <Form form={resetForm} layout="vertical">
          <Form.Item
            name="password"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 8, message: '密码至少 8 位' },
            ]}
          >
            <Input.Password placeholder="至少 8 位" maxLength={32} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
