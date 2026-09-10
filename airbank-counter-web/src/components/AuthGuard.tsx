import type { ReactNode } from 'react';
import { Button, Result } from 'antd';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { hasPerm } from '../utils/menu';

/** 路由守卫：未登录跳登录页 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/** 权限守卫：权限不足显示 403 Result 页 */
export function RequirePerm({ perm, children }: { perm?: string | null; children: ReactNode }) {
  const perms = useAuthStore((s) => s.perms);
  const navigate = useNavigate();
  if (perm && !hasPerm(perms, perm)) {
    return (
      <Result
        status="403"
        title="403"
        subTitle="抱歉，您没有权限访问该页面（如需访问请联系管理员授权）"
        extra={
          <Button type="primary" onClick={() => navigate('/workbench')}>
            返回工作台
          </Button>
        }
      />
    );
  }
  return <>{children}</>;
}
