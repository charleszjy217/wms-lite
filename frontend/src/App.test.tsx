import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { themeConfig } from './theme';
import { AuthProvider } from './contexts/AuthContext';
import App from './App';

/* ------------------------------------------------------------------ */
/*  Mock dashboard API to avoid network errors during testing          */
/* ------------------------------------------------------------------ */

vi.mock('./api/dashboard', () => ({
  dashboardApi: {
    overview: vi.fn().mockResolvedValue({
      data: { totalProducts: 128, totalInventory: 45680, nearExpiryCount: 9, lowStockCount: 5 },
    }),
    nearExpiry: vi.fn().mockResolvedValue({
      data: [
        { id: 'B001', productName: '鲜牛奶', warehouseName: '一号冷库', quantity: 200, unit: '箱', expiryDate: '2026-07-10', daysUntilExpiry: 6 },
      ],
    }),
    valuation: vi.fn().mockResolvedValue({
      data: {
        byWarehouse: [{ warehouse: '一号冷库', value: 285000 }],
        byCategory: [{ category: '乳制品', value: 165000 }],
      },
    }),
    trends: vi.fn().mockResolvedValue({
      data: [{ date: '07-01', inQuantity: 1200, outQuantity: 980 }],
    }),
  },
}));

/* ------------------------------------------------------------------ */
/*  测试辅助：使用 MemoryRouter 包裹完整 provider 链                      */
/* ------------------------------------------------------------------ */

function renderApp(initialRoute = '/') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <ConfigProvider locale={zhCN} theme={themeConfig}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ConfigProvider>
    </MemoryRouter>,
  );
}

describe('App', () => {
  beforeEach(() => {
    // 模拟已登录状态
    localStorage.setItem('token', 'test-jwt-token');
    localStorage.setItem(
      'user',
      JSON.stringify({
        id: '1',
        username: 'admin',
        displayName: '管理员',
        roles: ['ADMIN'],
      }),
    );
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('renders dashboard page with overview statistics', async () => {
    renderApp('/');
    // 仪表盘标题
    expect(await screen.findByText('首页仪表盘')).toBeInTheDocument();
    // 总览卡片
    expect(await screen.findByText('总商品数')).toBeInTheDocument();
    expect(await screen.findByText('总库存量')).toBeInTheDocument();
    expect(await screen.findByText('临期批次数')).toBeInTheDocument();
    expect(await screen.findByText('低库存预警')).toBeInTheDocument();
  });

  it('redirects to login page when not authenticated', async () => {
    localStorage.clear();
    renderApp('/');
    expect(await screen.findByPlaceholderText('用户名')).toBeInTheDocument();
  });

  it('navigates to product page', async () => {
    renderApp('/products');
    expect(await screen.findByText('商品管理')).toBeInTheDocument();
  });

  it('navigates to warehouse page', async () => {
    renderApp('/warehouses');
    expect(await screen.findByText('仓库管理')).toBeInTheDocument();
  });

  it('renders login page directly', async () => {
    localStorage.clear();
    renderApp('/login');
    expect(await screen.findByPlaceholderText('用户名')).toBeInTheDocument();
    expect(await screen.findByText('库存管理系统')).toBeInTheDocument();
  });
});

