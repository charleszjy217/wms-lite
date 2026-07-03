import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { themeConfig } from '../../theme';
import { AuthProvider } from '../../contexts/AuthContext';
import App from '../../App';

/* ------------------------------------------------------------------ */
/*  Mock axios                                                         */
/* ------------------------------------------------------------------ */

vi.mock('../../api/client', () => ({
  default: {
    post: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
  setLogoutHandler: vi.fn(),
}));

import client from '../../api/client';

/* ------------------------------------------------------------------ */
/*  测试辅助                                                            */
/* ------------------------------------------------------------------ */

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <ConfigProvider locale={zhCN} theme={themeConfig}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ConfigProvider>
    </MemoryRouter>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('renders login form', () => {
    renderLogin();
    expect(screen.getByText('WMS-lite')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('用户名')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('密码')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '登 录' })).toBeInTheDocument();
  });

  it('shows validation errors on empty submit', async () => {
    renderLogin();
    fireEvent.click(screen.getByRole('button', { name: '登 录' }));
    expect(await screen.findByText('请输入用户名')).toBeInTheDocument();
    expect(await screen.findByText('请输入密码')).toBeInTheDocument();
  });

  it('calls login API on form submit', async () => {
    const mockPost = vi.mocked(client.post);
    mockPost.mockResolvedValueOnce({
      data: {
        accessToken: 'mock-jwt',
        user: {
          id: '1',
          username: 'testuser',
          displayName: '测试用户',
          roles: ['ADMIN'],
        },
      },
    });

    renderLogin();

    fireEvent.change(screen.getByPlaceholderText('用户名'), {
      target: { value: 'testuser' },
    });
    fireEvent.change(screen.getByPlaceholderText('密码'), {
      target: { value: 'testpass' },
    });
    fireEvent.click(screen.getByRole('button', { name: '登 录' }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/auth/login', {
        username: 'testuser',
        password: 'testpass',
      });
    });

    expect(localStorage.getItem('token')).toBe('mock-jwt');
  });
});
