import { Navigate, Route, Routes } from 'react-router-dom';
import AuthGuard from './components/AuthGuard';
import PortalLayout from './layouts/PortalLayout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import HomePage from './pages/HomePage';
import TransferPage from './pages/TransferPage';
import WealthPage from './pages/WealthPage';
import HoldingsPage from './pages/HoldingsPage';
import WealthOrdersPage from './pages/WealthOrdersPage';
import LoanPage from './pages/LoanPage';
import MyLoansPage from './pages/MyLoansPage';
import AccountsPage from './pages/AccountsPage';
import ReceiptsPage from './pages/ReceiptsPage';
import RiskPage from './pages/RiskPage';
import MessagesPage from './pages/MessagesPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<AuthGuard />}>
        <Route element={<PortalLayout />}>
          <Route path="/home" element={<HomePage />} />
          <Route path="/transfer" element={<TransferPage />} />
          <Route path="/wealth" element={<WealthPage />} />
          <Route path="/wealth/holdings" element={<HoldingsPage />} />
          <Route path="/wealth/orders" element={<WealthOrdersPage />} />
          <Route path="/loan" element={<LoanPage />} />
          <Route path="/loan/my" element={<MyLoansPage />} />
          <Route path="/accounts" element={<AccountsPage />} />
          <Route path="/receipts" element={<ReceiptsPage />} />
          <Route path="/risk" element={<RiskPage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
}
