import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Button, Result } from 'antd';
import { RequireAuth, RequirePerm } from './components/AuthGuard';
import WorkbenchLayout from './layouts/WorkbenchLayout';
import Login from './pages/Login';
import Workbench from './pages/Workbench';
import Shift from './pages/Shift';
import AccountOpen from './pages/biz/AccountOpen';
import CashDeposit from './pages/biz/CashDeposit';
import CashWithdraw from './pages/biz/CashWithdraw';
import Transfer from './pages/biz/Transfer';
import TimeDeposit from './pages/biz/TimeDeposit';
import Wealth from './pages/biz/Wealth';
import AccountManage from './pages/biz/AccountManage';
import Reverse from './pages/biz/Reverse';
import Review from './pages/Review';
import Customer from './pages/Customer';
import DaySettle from './pages/DaySettle';
import Vouchers from './pages/Vouchers';
import Tellers from './pages/admin/Tellers';
import Params from './pages/admin/Params';
import Batch from './pages/admin/Batch';
import Factory from './pages/admin/Factory';
import NotFound from './pages/NotFound';

/** 全局错误边界 */
class ErrorBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state = { error: undefined as Error | undefined };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('AirBank Counter Web crashed:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <Result
          status="error"
          title="页面出错了"
          subTitle={this.state.error.message}
          extra={
            <Button type="primary" onClick={() => window.location.reload()}>
              刷新页面
            </Button>
          }
        />
      );
    }
    return this.props.children;
  }
}

function permRoute(path: string, perm: string, element: ReactNode) {
  return (
    <Route key={path} path={path} element={<RequirePerm perm={perm}>{element}</RequirePerm>} />
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <RequireAuth>
                <WorkbenchLayout />
              </RequireAuth>
            }
          >
            <Route path="/" element={<Navigate to="/workbench" replace />} />
            <Route path="/workbench" element={<Workbench />} />
            <Route path="/shift" element={<Shift />} />

            {permRoute('/biz/account-open', 'counter:account-open', <AccountOpen />)}
            {permRoute('/biz/cash-deposit', 'counter:cash', <CashDeposit />)}
            {permRoute('/biz/cash-withdraw', 'counter:cash', <CashWithdraw />)}
            {permRoute('/biz/transfer', 'counter:transfer', <Transfer />)}
            {permRoute('/biz/time-deposit', 'counter:time', <TimeDeposit />)}
            {permRoute('/biz/wealth', 'counter:wealth', <Wealth />)}
            {permRoute('/biz/account-manage', 'counter:account-admin', <AccountManage />)}

            {permRoute('/review', 'review:authorize', <Review />)}
            {permRoute('/customer', 'counter:customer-query', <Customer />)}
            {permRoute('/reverse', 'counter:reverse', <Reverse />)}

            <Route path="/daysettle" element={<DaySettle />} />
            <Route path="/vouchers" element={<Vouchers />} />

            {permRoute('/admin/tellers', 'admin:manage', <Tellers />)}
            {permRoute('/admin/params', 'admin:manage', <Params />)}
            {permRoute('/admin/batch', 'admin:manage', <Batch />)}
            {permRoute('/admin/factory', 'admin:manage', <Factory />)}

            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
