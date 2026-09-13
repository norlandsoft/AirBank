import { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Card,
  Descriptions,
  Drawer,
  Empty,
  Modal,
  Radio,
  Space,
  Table,
  Tabs,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  getLoanDetail,
  listMyApplications,
  listMyLoans,
  repayLoan,
} from '../api/loan';
import type {
  LoanAccountVO,
  LoanApplicationVO,
  LoanDetailVO,
  LoanRepaymentVO,
  LoanScheduleVO,
} from '../api/types';
import OtpModal from '../components/OtpModal';
import StatusBadge from '../components/StatusBadge';
import { fenToYuan, formatRate } from '../utils/money';
import { newRequestNo } from '../api/http';

type RepayMode = 'INSTALLMENT' | 'SETTLE';

/** 我的贷款：借据列表（还款计划/还款）+ 申请记录 */
export default function MyLoansPage() {
  const [loans, setLoans] = useState<LoanAccountVO[]>([]);
  const [applications, setApplications] = useState<LoanApplicationVO[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<LoanDetailVO | null>(null);
  const [repayTarget, setRepayTarget] = useState<LoanAccountVO | null>(null);
  const [repayMode, setRepayMode] = useState<RepayMode>('INSTALLMENT');
  const [otpOpen, setOtpOpen] = useState(false);
  const [requestNo, setRequestNo] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [l, a] = await Promise.all([listMyLoans(), listMyApplications()]);
      setLoans(l);
      setApplications(a);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const openDetail = async (loanNo: string) => {
    try {
      setDetail(await getLoanDetail(loanNo));
    } catch {
      // 拦截器已提示
    }
  };

  const openRepay = (loan: LoanAccountVO) => {
    setDetail(null);
    setRepayTarget(loan);
    setRepayMode('INSTALLMENT');
  };

  const doRepay = async (otpCode: string) => {
    if (!repayTarget) return;
    try {
      const rp: LoanRepaymentVO = await repayLoan({
        requestNo,
        loanNo: repayTarget.loanNo,
        repayMode,
        otpCode,
      });
      setOtpOpen(false);
      setRepayTarget(null);
      Modal.success({
        title: rp.repayMode === 'SETTLE' ? '提前结清成功' : `第 ${rp.periodNo} 期还款成功`,
        content: (
          <div>
            <p>还款编号：{rp.repayNo}</p>
            <p>
              扣款 ¥{fenToYuan(rp.amount)}（本金 ¥{fenToYuan(rp.principalPart)} + 利息 ¥
              {fenToYuan(rp.interestPart)}）。
            </p>
          </div>
        ),
      });
      void reload();
    } catch {
      // 拦截器已提示（如余额不足）
    }
  };

  const loanColumns: ColumnsType<LoanAccountVO> = [
    { title: '借据号', dataIndex: 'loanNo', width: 180 },
    { title: '产品', dataIndex: 'productName', width: 110 },
    { title: '放款本金', dataIndex: 'principal', align: 'right', render: (v: string) => `¥${fenToYuan(v)}` },
    { title: '剩余本金', dataIndex: 'remainPrincipal', align: 'right', render: (v: string) => `¥${fenToYuan(v)}` },
    { title: '年利率', dataIndex: 'annualRate', align: 'right', render: (v: number) => formatRate(v) },
    {
      title: '下一期应还',
      key: 'next',
      render: (_, r) =>
        r.nextDueDate ? (
          <span>
            ¥{fenToYuan(r.nextDueAmount)}
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {' '}（{r.nextDueDate}）
            </Typography.Text>
          </span>
        ) : (
          '--'
        ),
    },
    { title: '状态', dataIndex: 'status', width: 90, render: (v: string) => <StatusBadge status={v} /> },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (_, r) => (
        <Space>
          <Button size="small" onClick={() => void openDetail(r.loanNo)}>
            详情
          </Button>
          <Button size="small" type="primary" disabled={r.status !== 'REPAYING'} onClick={() => openRepay(r)}>
            还款
          </Button>
        </Space>
      ),
    },
  ];

  const applyColumns: ColumnsType<LoanApplicationVO> = [
    { title: '申请编号', dataIndex: 'applyNo', width: 180 },
    { title: '产品', dataIndex: 'productName', width: 110 },
    { title: '申请金额', dataIndex: 'amount', align: 'right', render: (v: string) => `¥${fenToYuan(v)}` },
    { title: '期限', dataIndex: 'termMonths', width: 70, render: (v: number) => `${v} 个月` },
    {
      title: '批准金额',
      dataIndex: 'approveAmount',
      align: 'right',
      render: (v?: string) => (v ? `¥${fenToYuan(v)}` : '--'),
    },
    {
      title: '征信分',
      dataIndex: 'creditScore',
      width: 80,
      align: 'right',
      render: (v?: number) => v ?? '--',
    },
    { title: '状态', dataIndex: 'status', width: 100, render: (v: string) => <StatusBadge status={v} /> },
    {
      title: '备注',
      key: 'note',
      render: (_, r) =>
        r.status === 'REJECTED' ? (
          <Typography.Text type="danger" style={{ fontSize: 12 }}>
            {r.rejectReason}
          </Typography.Text>
        ) : r.loanNo ? (
          <Typography.Text style={{ fontSize: 12 }}>借据 {r.loanNo}</Typography.Text>
        ) : (
          '--'
        ),
    },
    { title: '申请时间', dataIndex: 'createdAt', width: 165, render: (v?: string) => v?.replace('T', ' ').slice(0, 19) },
  ];

  const scheduleColumns: ColumnsType<LoanScheduleVO> = [
    { title: '期次', dataIndex: 'periodNo', width: 60 },
    { title: '应还日', dataIndex: 'dueDate', width: 110 },
    { title: '本金', dataIndex: 'principal', align: 'right', render: (v: string) => fenToYuan(v) },
    { title: '利息', dataIndex: 'interest', align: 'right', render: (v: string) => fenToYuan(v) },
    { title: '合计', dataIndex: 'total', align: 'right', render: (v: string) => fenToYuan(v) },
    { title: '状态', dataIndex: 'status', width: 80, render: (v: string) => <StatusBadge status={v} /> },
  ];

  const repayColumns: ColumnsType<LoanRepaymentVO> = [
    { title: '还款编号', dataIndex: 'repayNo', width: 180 },
    {
      title: '方式',
      dataIndex: 'repayMode',
      width: 100,
      render: (v: string, r) => (v === 'SETTLE' ? '提前结清' : `第 ${r.periodNo} 期`),
    },
    { title: '金额', dataIndex: 'amount', align: 'right', render: (v: string) => `¥${fenToYuan(v)}` },
    { title: '状态', dataIndex: 'status', width: 80, render: (v: string) => <StatusBadge status={v} /> },
    { title: '时间', dataIndex: 'createdAt', width: 165, render: (v?: string) => v?.replace('T', ' ').slice(0, 19) },
  ];

  return (
    <div>
      <Card size="small">
        <Tabs
          items={[
            {
              key: 'loans',
              label: `我的借据（${loans.length}）`,
              children: (
                <Table<LoanAccountVO>
                  rowKey="loanNo"
                  size="small"
                  loading={loading}
                  columns={loanColumns}
                  dataSource={loans}
                  pagination={false}
                  locale={{ emptyText: <Empty description="暂无借据，去「贷款超市」申请" /> }}
                />
              ),
            },
            {
              key: 'applications',
              label: `申请记录（${applications.length}）`,
              children: (
                <Table<LoanApplicationVO>
                  rowKey="applyNo"
                  size="small"
                  loading={loading}
                  columns={applyColumns}
                  dataSource={applications}
                  pagination={false}
                  locale={{ emptyText: <Empty description="暂无申请记录" /> }}
                />
              ),
            },
          ]}
        />
      </Card>

      {/* 借据详情抽屉 */}
      <Drawer
        title={detail ? `借据 ${detail.account.loanNo}` : ''}
        width={640}
        open={!!detail}
        onClose={() => setDetail(null)}
      >
        {detail && (
          <>
            <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="产品">{detail.account.productName}</Descriptions.Item>
              <Descriptions.Item label="状态"><StatusBadge status={detail.account.status} /></Descriptions.Item>
              <Descriptions.Item label="放款本金">¥{fenToYuan(detail.account.principal)}</Descriptions.Item>
              <Descriptions.Item label="剩余本金">¥{fenToYuan(detail.account.remainPrincipal)}</Descriptions.Item>
              <Descriptions.Item label="执行年利率">{formatRate(detail.account.annualRate)}</Descriptions.Item>
              <Descriptions.Item label="期限">{detail.account.termMonths} 个月（等额本息）</Descriptions.Item>
              <Descriptions.Item label="放款日">{detail.account.disburseDate}</Descriptions.Item>
              <Descriptions.Item label="放款账户">{detail.account.acctNo}</Descriptions.Item>
              <Descriptions.Item label="已还本金">¥{fenToYuan(detail.account.paidPrincipal)}</Descriptions.Item>
              <Descriptions.Item label="已还利息">¥{fenToYuan(detail.account.paidInterest)}</Descriptions.Item>
            </Descriptions>
            <Typography.Title level={5}>还款计划</Typography.Title>
            <Table<LoanScheduleVO>
              rowKey="periodNo"
              size="small"
              columns={scheduleColumns}
              dataSource={detail.schedules}
              pagination={false}
              style={{ marginBottom: 16 }}
            />
            <Typography.Title level={5}>还款记录</Typography.Title>
            <Table<LoanRepaymentVO>
              rowKey="repayNo"
              size="small"
              columns={repayColumns}
              dataSource={detail.repayments}
              pagination={false}
              locale={{ emptyText: <Empty description="暂无还款记录" /> }}
            />
            {detail.account.status === 'REPAYING' && (
              <Button
                type="primary"
                block
                size="large"
                style={{ marginTop: 16 }}
                onClick={() => openRepay(detail.account)}
              >
                立即还款
              </Button>
            )}
          </>
        )}
      </Drawer>

      {/* 还款方式选择 */}
      <Modal
        title={repayTarget ? `还款 · 借据 ${repayTarget.loanNo}` : ''}
        open={!!repayTarget}
        onCancel={() => setRepayTarget(null)}
        onOk={() => {
          setRequestNo(newRequestNo());
          setOtpOpen(true);
        }}
        okText="下一步"
      >
        {repayTarget && (
          <>
            <Radio.Group
              value={repayMode}
              onChange={(e) => setRepayMode(e.target.value as RepayMode)}
              style={{ marginBottom: 16 }}
            >
              <Radio value="INSTALLMENT">还当期（最早未还一期）</Radio>
              <Radio value="SETTLE">提前结清</Radio>
            </Radio.Group>
            <Descriptions column={1} size="small" bordered>
              {repayMode === 'INSTALLMENT' ? (
                <>
                  <Descriptions.Item label="当期应还">
                    ¥{fenToYuan(repayTarget.nextDueAmount)}（{repayTarget.nextDueDate} 到期）
                  </Descriptions.Item>
                </>
              ) : (
                <>
                  <Descriptions.Item label="剩余本金">¥{fenToYuan(repayTarget.remainPrincipal)}</Descriptions.Item>
                  <Descriptions.Item label="结清利息">按剩余本金 × 月利率 计收当期利息</Descriptions.Item>
                </>
              )}
              <Descriptions.Item label="扣款账户">本人活期账户（放款账户 {repayTarget.acctNo}）</Descriptions.Item>
            </Descriptions>
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 12 }}>
              还款金额由信贷系统按还款计划权威计算；扣款账户余额不足将还款失败。
            </Typography.Text>
          </>
        )}
      </Modal>

      {/* OTP 确认 */}
      <OtpModal
        open={otpOpen}
        scene="LOAN"
        title="还款确认"
        description={`借据：${repayTarget?.loanNo ?? ''}，请输入短信验证码确认还款扣款。`}
        onCancel={() => setOtpOpen(false)}
        onVerify={doRepay}
      />
    </div>
  );
}
