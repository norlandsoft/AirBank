import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Col, Descriptions, message, Row, Space, Tag } from 'antd';
import { LoginOutlined, LogoutOutlined } from '@ant-design/icons';
import { getShiftToday, signIn, signOut } from '../api/counter';
import { errCode } from '../api/http';
import type { ShiftVO } from '../api/types';
import { fenToYuan } from '../utils/money';

function statusTag(status?: string) {
  switch (status) {
    case 'SIGNED_IN':
      return <Tag color="processing">已签到</Tag>;
    case 'SIGNED_OUT':
      return <Tag color="default">已签退</Tag>;
    default:
      return <Tag color="warning">未签到</Tag>;
  }
}

/** 签到签退：显示当日签到状态与尾箱（上日结转 / 收 / 付 / 余额） */
export default function Shift() {
  const [info, setInfo] = useState<ShiftVO | null>(null);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setInfo(await getShiftToday());
    } catch {
      /* 拦截器已提示 */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const signedIn = info?.status === 'SIGNED_IN';
  const signedOut = info?.status === 'SIGNED_OUT';

  const doSignIn = async () => {
    setActing(true);
    try {
      await signIn();
      message.success('签到成功，尾箱已启用');
      await load();
    } catch {
      /* 拦截器已提示 */
    } finally {
      setActing(false);
    }
  };

  const doSignOut = async () => {
    setActing(true);
    try {
      await signOut();
      message.success('签退成功');
      await load();
    } catch (e) {
      if (errCode(e) === 5007) {
        message.warning('签退失败：请先完成日结，再进行签退（业务办理 → 日结签退）');
      }
    } finally {
      setActing(false);
    }
  };

  const box = info?.box;

  return (
    <Row gutter={[16, 16]}>
      <Col span={14}>
        <Card title="签到 / 签退" loading={loading} extra={statusTag(info?.status)}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Descriptions bordered column={1} size="small" items={[
              { key: 'teller', label: '柜员', children: info?.tellerNo || '-' },
              { key: 'in', label: '签到时间', children: info?.signInTime ?? '-' },
              { key: 'out', label: '签退时间', children: info?.signOutTime ?? '-' },
            ]} />
            <Space>
              <Button
                type="primary"
                icon={<LoginOutlined />}
                loading={acting}
                disabled={signedIn || signedOut}
                onClick={doSignIn}
              >
                签到
              </Button>
              <Button
                danger
                icon={<LogoutOutlined />}
                loading={acting}
                disabled={!signedIn}
                onClick={doSignOut}
              >
                签退
              </Button>
              <span style={{ color: 'rgba(0,0,0,0.45)', fontSize: 12 }}>签退前需完成日结（错误码 5007 提示先日结）</span>
            </Space>
          </Space>
        </Card>
      </Col>
      <Col span={10}>
        <Card title="尾箱（单位：元）" loading={loading}>
          <Descriptions bordered column={1} size="small" items={[
            { key: 'begin', label: '上日结转', children: `¥ ${fenToYuan(box?.beginBalance as string | number)}` },
            { key: 'in', label: '本日现金收入', children: `¥ ${fenToYuan(box?.cashIn as string | number)}`, },
            { key: 'out', label: '本日现金支出', children: `¥ ${fenToYuan(box?.cashOut as string | number)}` },
            { key: 'bal', label: '尾箱余额', children: <b>¥ {fenToYuan(box?.balance as string | number)}</b> },
          ]} />
        </Card>
      </Col>
    </Row>
  );
}
