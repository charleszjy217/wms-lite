import { ConfigProvider, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { Routes, Route, Navigate } from 'react-router-dom';
import { themeConfig } from './theme';
import { AuthProvider } from './contexts/AuthContext';
import DashboardLayout from './layouts/DashboardLayout';
import AuthGuard from './components/AuthGuard';
import LoginPage from './pages/auth/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ProductListPage from './pages/product/ProductListPage';
import WarehouseListPage from './pages/warehouse/WarehouseListPage';
import BatchListPage from './pages/batch/BatchListPage';
import InventoryPage from './pages/inventory/InventoryPage';
import InboundForm from './pages/inventory/InboundForm';
import OutboundForm from './pages/inventory/OutboundForm';
import TransferForm from './pages/inventory/TransferForm';
import StocktakeForm from './pages/inventory/StocktakeForm';
import PricingListPage from './pages/pricing/PricingListPage';
import IntegrationPage from './pages/integration/IntegrationPage';

/**
 * 应用根组件 — 主题 / Locale / Auth / 路由
 * 注意：main.tsx 外层已包裹 <BrowserRouter>
 */
export default function App() {
  return (
    <ConfigProvider locale={zhCN} theme={themeConfig}>
      <AntApp>
        <AuthProvider>
          <Routes>
            {/* 公开路由 */}
            <Route path="/login" element={<LoginPage />} />

            {/* 受保护路由 */}
            <Route
              element={
                <AuthGuard>
                  <DashboardLayout />
                </AuthGuard>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="products" element={<ProductListPage />} />
              <Route path="warehouses" element={<WarehouseListPage />} />
              <Route path="batches" element={<BatchListPage />} />
              <Route path="inventory" element={<InventoryPage />} />
              <Route path="inbound" element={<InboundForm />} />
              <Route path="outbound" element={<OutboundForm />} />
              <Route path="transfer" element={<TransferForm />} />
              <Route path="stocktake" element={<StocktakeForm />} />
              <Route path="pricing" element={<PricingListPage />} />
              <Route path="integration" element={<IntegrationPage />} />
            </Route>

            {/* 兜底：所有未匹配路由重定向首页 */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </AntApp>
    </ConfigProvider>
  );
}

