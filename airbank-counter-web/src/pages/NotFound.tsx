import { Button, Result } from 'antd';
import { useNavigate } from 'react-router-dom';

/** 404 / 兜底页（403 由 RequirePerm 内的 Result 呈现） */
export default function NotFound() {
  const navigate = useNavigate();
  return (
    <Result
      status="404"
      title="404"
      subTitle="抱歉，您访问的页面不存在"
      extra={
        <Button type="primary" onClick={() => navigate('/workbench')}>
          返回工作台
        </Button>
      }
    />
  );
}
