import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { themeConfig } from './theme';
import { AuthProvider } from './contexts/AuthContext';
import App from './App';

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

  it('renders dashboard page with title and building message', async () => {
    renderApp('/');
    expect(await screen.findByText('首页')).toBeInTheDocument();
    expect(await screen.findByText(/正在建设中/)).toBeInTheDocument();
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

