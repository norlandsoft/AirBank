import { useEffect, useState } from 'react';
import { Button, Card, Descriptions, Radio, Result, Space, Tag, Typography, message } from 'antd';
import { latestRiskAssessment, submitRiskAssessment } from '../api/auth';
import { useAuthStore } from '../stores/auth';

interface Question {
  key: string;
  title: string;
  options: { score: number; label: string }[];
}

/** 风险测评问卷：5 题，每题 5 个选项对应 1~5 分 */
const QUESTIONS: Question[] = [
  {
    key: 'income',
    title: '1. 您的收入来源与稳定性如何？',
    options: [
      { score: 1, label: '收入不稳定，无固定来源' },
      { score: 2, label: '收入一般，波动较大' },
      { score: 3, label: '收入稳定，略有结余' },
      { score: 4, label: '收入稳定且有较多结余' },
      { score: 5, label: '收入很高且来源多元' },
    ],
  },
  {
    key: 'experience',
    title: '2. 您的投资经验如何？',
    options: [
      { score: 1, label: '从未投资过任何理财产品' },
      { score: 2, label: '只买过存款、货币基金等低风险产品' },
      { score: 3, label: '买过债券基金、银行理财等中低风险产品' },
      { score: 4, label: '有股票、混合基金等中风险产品经验' },
      { score: 5, label: '熟悉股票、衍生品等高风险产品' },
    ],
  },
  {
    key: 'knowledge',
    title: '3. 您对金融知识的了解程度？',
    options: [
      { score: 1, label: '完全不了解' },
      { score: 2, label: '了解一点存款利率' },
      { score: 3, label: '基本了解常见理财概念' },
      { score: 4, label: '较熟悉各类产品与风险指标' },
      { score: 5, label: '专业级，能独立分析产品说明书' },
    ],
  },
  {
    key: 'loss',
    title: '4. 若投资出现亏损，您的承受能力是？',
    options: [
      { score: 1, label: '不能接受任何亏损' },
      { score: 2, label: '可接受 5% 以内的亏损' },
      { score: 3, label: '可接受 10% 以内的亏损' },
      { score: 4, label: '可接受 20% 以内的亏损' },
      { score: 5, label: '可接受 20% 以上的亏损' },
    ],
  },
  {
    key: 'term',
    title: '5. 您计划的资金投资期限是？',
    options: [
      { score: 1, label: '随时可能要用' },
      { score: 2, label: '3 个月以内' },
      { score: 3, label: '3~12 个月' },
      { score: 4, label: '1~3 年' },
      { score: 5, label: '3 年以上' },
    ],
  },
];

const LEVEL_META: Record<string, { color: string; name: string; desc: string }> = {
  C1: { color: 'green', name: '保守型', desc: '倾向于保本，适合 R1 及以下风险等级产品。' },
  C2: { color: 'cyan', name: '稳健型', desc: '追求稳健收益，适合 R2 及以下风险等级产品。' },
  C3: { color: 'blue', name: '平衡型', desc: '能承受一定波动，适合 R3 及以下风险等级产品。' },
  C4: { color: 'orange', name: '成长型', desc: '追求较高收益，可购买全部在售产品。' },
  C5: { color: 'red', name: '进取型', desc: '追求高收益并承受高波动，可购买全部在售产品。' },
};

export default function RiskPage() {
  const user = useAuthStore((s) => s.user);
  const setRiskLevel = useAuthStore((s) => s.setRiskLevel);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ level: string; score: number } | null>(null);
  const [currentLevel, setCurrentLevel] = useState<string | null>(user?.riskLevel ?? null);

  useEffect(() => {
    if (!user?.customerId) return;
    latestRiskAssessment(user.customerId)
      .then((vo) => {
        if (vo?.level) setCurrentLevel(vo.level);
      })
      .catch(() => {
        // 忽略：未测评
      });
  }, [user?.customerId]);

  const answeredCount = QUESTIONS.filter((q) => scores[q.key]).length;

  const handleSubmit = async () => {
    if (answeredCount < QUESTIONS.length) {
      message.warning('请完成全部 5 道题目');
      return;
    }
    if (!user?.customerId) {
      message.error('缺少客户信息，请重新登录');
      return;
    }
    setSubmitting(true);
    try {
      const level = await submitRiskAssessment({
        customerId: user.customerId,
        scores: QUESTIONS.map((q) => scores[q.key]),
      });
      const total = QUESTIONS.reduce((s, q) => s + scores[q.key], 0);
      setResult({ level, score: total });
      setCurrentLevel(level);
      setRiskLevel(level);
      message.success(`测评完成：${level}`);
    } catch {
      // 拦截器已提示
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    const meta = LEVEL_META[result.level] ?? { color: 'blue', name: result.level, desc: '' };
    return (
      <Card>
        <Result
          status="success"
          title="风险测评完成"
          subTitle={`总分 ${result.score} / ${QUESTIONS.length * 5} 分`}
          icon={<span />}
          extra={
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div style={{ textAlign: 'center' }}>
                <Tag color={meta.color} style={{ fontSize: 32, padding: '8px 24px', borderRadius: 8 }}>
                  {result.level}
                </Tag>
                <Typography.Title level={3} style={{ marginTop: 12, marginBottom: 4 }}>
                  {meta.name}
                </Typography.Title>
                <Typography.Text type="secondary">{meta.desc}</Typography.Text>
              </div>
              <Descriptions column={1} bordered size="small" style={{ maxWidth: 480, margin: '0 auto' }}>
                <Descriptions.Item label="测评结果等级">{result.level}（{meta.name}）</Descriptions.Item>
                <Descriptions.Item label="可购产品范围">{meta.desc}</Descriptions.Item>
                <Descriptions.Item label="生效范围">理财超市中超出等级的产品将不可购买</Descriptions.Item>
              </Descriptions>
              <Space style={{ justifyContent: 'center' }}>
                <Button
                  onClick={() => {
                    setResult(null);
                    setScores({});
                  }}
                >
                  重新测评
                </Button>
              </Space>
            </Space>
          }
        />
      </Card>
    );
  }

  return (
    <Card
      title="风险承受能力测评"
      extra={
        currentLevel ? (
          <Space>
            <Typography.Text type="secondary">当前等级：</Typography.Text>
            <Tag color={LEVEL_META[currentLevel]?.color ?? 'blue'}>{currentLevel}</Tag>
          </Space>
        ) : (
          <Typography.Text type="secondary">尚未测评</Typography.Text>
        )
      }
    >
      <Typography.Paragraph type="secondary">
        共 5 题，请根据实际情况选择。测评结果将决定您可购买的理财产品的最高风险等级（C1↔R1、C2↔R2、C3↔R3，C4/C5 可购全部）。
      </Typography.Paragraph>
      <Space direction="vertical" size="large" style={{ width: '100%', marginTop: 8 }}>
        {QUESTIONS.map((q) => (
          <div key={q.key}>
            <Typography.Text strong>{q.title}</Typography.Text>
            <Radio.Group
              style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}
              value={scores[q.key]}
              onChange={(e) => setScores((s) => ({ ...s, [q.key]: e.target.value as number }))}
            >
              {q.options.map((opt) => (
                <Radio key={opt.score} value={opt.score}>
                  {opt.label}
                </Radio>
              ))}
            </Radio.Group>
          </div>
        ))}
        <div style={{ textAlign: 'center' }}>
          <Button
            type="primary"
            size="large"
            style={{ minWidth: 200 }}
            loading={submitting}
            disabled={answeredCount < QUESTIONS.length}
            onClick={() => void handleSubmit()}
          >
            {answeredCount < QUESTIONS.length ? `已完成 ${answeredCount}/5 题` : '提交测评'}
          </Button>
        </div>
      </Space>
    </Card>
  );
}
