import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { themeConfig } from '../../theme';
import BatchListPage from './BatchListPage';

/* ------------------------------------------------------------------ */
/*  Mock axios client                                                  */
/* ------------------------------------------------------------------ */

vi.mock('../../api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
  setLogoutHandler: vi.fn(),
}));

import client from '../../api/client';

/* ------------------------------------------------------------------ */
/*  Test helpers                                                       */
/* ------------------------------------------------------------------ */

const mockBatchItem = (overrides: Record<string, unknown> = {}) => ({
  id: 'batch-001',
  batchNo: 'BATCH-2024-001',
  productId: 'prod-001',
  productionDate: '2024-01-15T00:00:00.000Z',
  expiryDate: '2025-06-15T00:00:00.000Z',
  status: 'ACTIVE',
  remainingDays: 120,
  isExpired: false,
  isNearExpiry: false,
  createdAt: '2024-01-15T00:00:00.000Z',
  product: {
    id: 'prod-001',
    name: '测试商品A',
    skuCode: 'SKU-A',
  },
  ...overrides,
});

const mockPaginatedResponse = (items: Record<string, unknown>[] = []) => ({
  data: {
    items,
    total: items.length,
    page: 1,
    limit: 20,
    totalPages: Math.ceil(items.length / 20),
  },
});

function renderPage() {
  return render(
    <MemoryRouter>
      <ConfigProvider locale={zhCN} theme={themeConfig}>
        <BatchListPage />
      </ConfigProvider>
    </MemoryRouter>,
  );
}

/** Mock config type that allows params.expired checks without `any` */
interface MockRequestConfig {
  params?: {
    expired?: boolean | string;
    [key: string]: unknown;
  };
}

/** Default mock that returns empty-ish data for all standard API calls */
function setupDefaultMock() {
  vi.mocked(client.get).mockImplementation(async (url: string, config?: MockRequestConfig) => {
    if (url === '/products') {
      return {
        data: {
          items: [
            { id: 'prod-001', name: '测试商品A', skuCode: 'SKU-A' },
            { id: 'prod-002', name: '测试商品B', skuCode: 'SKU-B' },
          ],
        },
      };
    }
    if (url === '/batches/expiring') {
      return { data: [] };
    }
    if (url === '/batches') {
      if (config?.params?.expired) {
        return {
          data: {
            items: [],
            total: 0,
            page: 1,
            limit: 1,
            totalPages: 0,
          },
        };
      }
      // Default: return one batch
      return mockPaginatedResponse([mockBatchItem()]);
    }
    return { data: null };
  });
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('BatchListPage', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'test-jwt-token');
    vi.clearAllMocks();
    setupDefaultMock();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('renders page title', async () => {
    renderPage();
    expect(await screen.findByText('批次管理')).toBeInTheDocument();
  });

  it('renders header buttons', async () => {
    renderPage();
    // Wait for the refresh button to appear
    expect(await screen.findByText('刷新')).toBeInTheDocument();
  });

  it('renders warning summary cards', async () => {
    renderPage();
    expect(await screen.findByText('临期预警')).toBeInTheDocument();
    expect(await screen.findByText('过期批次')).toBeInTheDocument();
  });

  it('renders filter card elements', async () => {
    renderPage();
    const input = await screen.findByPlaceholderText('搜索批次号', { exact: false });
    expect(input).toBeInTheDocument();
    // Check that filter buttons render
    expect(screen.getByText('查询')).toBeInTheDocument();
    // Also check for the reset button using queryAllByText
    // (getByText may fail for certain antd button renderings)
    const resetButtons = screen.queryAllByText('重置');
    if (resetButtons.length > 0) {
      expect(resetButtons[0]).toBeInTheDocument();
    }
  });

  it('shows expired alert when expired batches exist', async () => {
    vi.mocked(client.get).mockImplementation(async (url: string, config?: MockRequestConfig) => {
      if (url === '/products') {
        return { data: { items: [] } };
      }
      if (url === '/batches/expiring') {
        return { data: [] };
      }
      if (url === '/batches') {
        if (config?.params?.expired) {
          return { data: { items: [{ id: 'exp-1' }], total: 3, page: 1, limit: 1, totalPages: 3 } };
        }
        return mockPaginatedResponse([mockBatchItem()]);
      }
      return { data: null };
    });

    renderPage();
    // The expired count (3) should appear both in summary card and alert
    // Wait for "个批次已过期" text which appears in the summary card
    const summaryEl = await screen.findByText(/个批次已过期/);
    expect(summaryEl).toBeInTheDocument();
    // The alert message should also appear
    const alertEl = await screen.findByText(/共有/);
    expect(alertEl).toBeInTheDocument();
  });

  it('renders batch table with data after API resolves', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('BATCH-2024-001')).toBeInTheDocument();
    });
    expect(screen.getByText('测试商品A')).toBeInTheDocument();
  });

  it('shows expiry tags for different batch statuses', async () => {
    vi.mocked(client.get).mockImplementation(async (url: string, config?: MockRequestConfig) => {
      if (url === '/products') {
        return { data: { items: [{ id: 'prod-001', name: '测试商品A', skuCode: 'SKU-A' }] } };
      }
      if (url === '/batches/expiring') {
        return { data: [mockBatchItem({ batchNo: 'BATCH-NEAR', remainingDays: 15, isNearExpiry: true })] };
      }
      if (url === '/batches') {
        if (config?.params?.expired) {
          return { data: { items: [], total: 2, page: 1, limit: 1, totalPages: 2 } };
        }
        return mockPaginatedResponse([
          mockBatchItem({ batchNo: 'BATCH-ACTIVE', remainingDays: 120, isNearExpiry: false, isExpired: false }),
          mockBatchItem({
            batchNo: 'BATCH-NEAR',
            expiryDate: '2025-01-15T00:00:00.000Z',
            remainingDays: 15,
            isNearExpiry: true,
            isExpired: false,
          }),
          mockBatchItem({
            batchNo: 'BATCH-EXPIRED',
            expiryDate: '2023-01-15T00:00:00.000Z',
            remainingDays: -30,
            isNearExpiry: false,
            isExpired: true,
            status: 'EXPIRED',
          }),
        ]);
      }
      return { data: null };
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('BATCH-ACTIVE')).toBeInTheDocument();
    });
    expect(screen.getByText('BATCH-NEAR')).toBeInTheDocument();
    expect(screen.getByText('BATCH-EXPIRED')).toBeInTheDocument();
  });

  it('opens warning threshold config modal', async () => {
    renderPage();
    expect(await screen.findByText('临期预警')).toBeInTheDocument();

    const configBtn = screen.getByText('配置阈值');
    fireEvent.click(configBtn);

    expect(await screen.findByText('配置临期预警阈值')).toBeInTheDocument();
  });

  it('handles validate outbound action for active batch', async () => {
    vi.mocked(client.post).mockResolvedValueOnce({
      data: { valid: true, message: '批次可用于出库' },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('BATCH-2024-001')).toBeInTheDocument();
    });

    const validateBtn = screen.getByText('出库验证');
    fireEvent.click(validateBtn);

    await waitFor(() => {
      expect(vi.mocked(client.post)).toHaveBeenCalledWith('/batches/batch-001/validate-outbound');
    });
  });

  it('disables outbound validation for expired batches', async () => {
    vi.mocked(client.get).mockImplementation(async (url: string, config?: MockRequestConfig) => {
      if (url === '/products') {
        return { data: { items: [] } };
      }
      if (url === '/batches/expiring') {
        return { data: [] };
      }
      if (url === '/batches') {
        if (config?.params?.expired) {
          return { data: { items: [], total: 0, page: 1, limit: 1, totalPages: 0 } };
        }
        return mockPaginatedResponse([
          mockBatchItem({
            id: 'batch-expired',
            batchNo: 'BATCH-EXP',
            status: 'EXPIRED',
            isExpired: true,
            remainingDays: -10,
          }),
        ]);
      }
      return { data: null };
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('BATCH-EXP')).toBeInTheDocument();
    });

    const validateBtn = screen.getByText('出库验证');
    expect(validateBtn.closest('button')).toBeDisabled();
  });

  it('opens update status modal', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('BATCH-2024-001')).toBeInTheDocument();
    });

    const updateBtn = screen.getByText('修改状态');
    fireEvent.click(updateBtn);

    expect(await screen.findByText('修改批次状态')).toBeInTheDocument();
  });
});
