import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { AuthProvider } from '../../contexts/AuthContext';
import PricingListPage from './PricingListPage';

/* ------------------------------------------------------------------ */
/*  Mock API                                                           */
/* ------------------------------------------------------------------ */

const mockListPriceList = vi.fn();
const mockListProducts = vi.fn();
const mockAdjust = vi.fn();
const mockBatchAdjust = vi.fn();
const mockHistory = vi.fn();

vi.mock('../../api/pricing', () => ({
  pricingApi: {
    list: (...args: unknown[]) => mockListPriceList(...args),
    listProducts: (...args: unknown[]) => mockListProducts(...args),
    adjust: (...args: unknown[]) => mockAdjust(...args),
    batchAdjust: (...args: unknown[]) => mockBatchAdjust(...args),
    history: (...args: unknown[]) => mockHistory(...args),
  },
}));

/* ------------------------------------------------------------------ */
/*  Mock data                                                          */
/* ------------------------------------------------------------------ */

const MOCK_PRODUCTS = [
  { id: 'p1', name: '商品A', category: '电子产品', currentPrice: 100, unit: '个' },
  { id: 'p2', name: '商品B', category: '食品', currentPrice: 20, unit: '袋' },
  { id: 'p3', name: '商品C', category: '电子产品', currentPrice: 250, unit: '个' },
];

const MOCK_PRICE_LIST = [
  { id: 'pl1', productId: 'p1', productName: '商品A', category: '电子产品', currentPrice: 100, priceList: '标准价目表', effectiveDate: '2026-07-01' },
  { id: 'pl2', productId: 'p2', productName: '商品B', category: '食品', currentPrice: 20, priceList: '标准价目表', effectiveDate: '2026-07-01' },
  { id: 'pl3', productId: 'p3', productName: '商品C', category: '电子产品', currentPrice: 250, priceList: '批发价目表', effectiveDate: '2026-07-15' },
];

const MOCK_HISTORY = [
  { id: 'h1', productId: 'p1', productName: '商品A', category: '电子产品', oldPrice: 80, newPrice: 100, operator: '管理员', reason: '成本上涨', createdAt: '2026-07-01 10:00:00', effectiveDate: '2026-07-01' },
  { id: 'h2', productId: 'p2', productName: '商品B', category: '食品', oldPrice: 25, newPrice: 20, operator: '测试员', reason: '促销活动', createdAt: '2026-06-28 14:30:00', effectiveDate: '2026-07-01' },
];

/* ------------------------------------------------------------------ */
/*  测试辅助                                                            */
/* ------------------------------------------------------------------ */

function renderPricing() {
  return render(
    <MemoryRouter initialEntries={['/pricing']}>
      <ConfigProvider locale={zhCN}>
        <AuthProvider>
          <PricingListPage />
        </AuthProvider>
      </ConfigProvider>
    </MemoryRouter>,
  );
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('PricingListPage', () => {
  beforeEach(() => {
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
    vi.clearAllMocks();

    // Default mock resolutions
    mockListPriceList.mockResolvedValue({ data: MOCK_PRICE_LIST });
    mockListProducts.mockResolvedValue({ data: MOCK_PRODUCTS });
    mockHistory.mockResolvedValue({ data: MOCK_HISTORY });
    mockAdjust.mockResolvedValue({ data: { id: 'new-adj' } });
    mockBatchAdjust.mockResolvedValue({ data: [] });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('渲染页面标题和标签页', async () => {
    renderPricing();
    expect(screen.getByText('价格管理')).toBeInTheDocument();
    expect(screen.getByText('价格列表')).toBeInTheDocument();
    expect(screen.getByText('单品调价')).toBeInTheDocument();
    expect(screen.getByText('批量调价')).toBeInTheDocument();
    expect(screen.getByText('调价历史')).toBeInTheDocument();
  });

  it('默认显示价格列表标签页且加载数据', async () => {
    renderPricing();
    await waitFor(() => {
      expect(mockListPriceList).toHaveBeenCalled();
    });
    // 等待数据加载完成（商品名可能在 price list 和 history 表中同时出现）
    await waitFor(() => {
      const items = screen.getAllByText('商品A');
      expect(items.length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText('商品B').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('商品C').length).toBeGreaterThanOrEqual(1);
  });

  it('价格列表支持按商品名搜索过滤', async () => {
    renderPricing();
    await waitFor(() => {
      expect(screen.getAllByText('商品A').length).toBeGreaterThanOrEqual(1);
    });

    const searchInput = screen.getByPlaceholderText('搜索商品名或类别');
    fireEvent.change(searchInput, { target: { value: '商品A' } });

    expect(screen.getAllByText('商品A').length).toBeGreaterThanOrEqual(1);
    // 商品B 在过滤后的列表中被隐藏
    expect(screen.queryByText('商品B')).not.toBeInTheDocument();
  });

  it('切换至单品调价标签页并渲染表单', async () => {
    renderPricing();
    fireEvent.click(screen.getByText('单品调价'));

    await waitFor(() => {
      expect(mockListProducts).toHaveBeenCalled();
    });

    expect(screen.getByPlaceholderText('输入新价格')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('请输入调价原因')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '提交调价' })).toBeInTheDocument();
  });

  it('切换至批量调价标签页', async () => {
    renderPricing();
    fireEvent.click(screen.getByText('批量调价'));

    await waitFor(() => {
      expect(screen.getByText('筛选条件')).toBeInTheDocument();
    });
    expect(screen.getByText('调价参数')).toBeInTheDocument();
    expect(screen.getByText('固定金额')).toBeInTheDocument();
    expect(screen.getByText('百分比')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '提交批量调价' })).toBeInTheDocument();
  });

  it('切换至调价历史标签页并加载历史记录', async () => {
    renderPricing();
    fireEvent.click(screen.getByText('调价历史'));

    await waitFor(() => {
      expect(mockHistory).toHaveBeenCalled();
    });

    // 历史数据中两条记录分别包含 商品A 和 商品B
    await waitFor(() => {
      expect(screen.getAllByText('商品A').length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText('商品B').length).toBeGreaterThanOrEqual(1);

    // 验证价格展示（在历史表中有唯一性）
    expect(screen.getByText('¥ 80.00')).toBeInTheDocument();
    expect(screen.getByText('¥ 100.00')).toBeInTheDocument();
    expect(screen.getByText('管理员')).toBeInTheDocument();
    expect(screen.getByText('测试员')).toBeInTheDocument();
  });

  it('调价历史支持搜索过滤', async () => {
    renderPricing();
    fireEvent.click(screen.getByText('调价历史'));
    await waitFor(() => {
      expect(screen.getAllByText('商品A').length).toBeGreaterThanOrEqual(1);
    });

    const searchInput = screen.getByPlaceholderText('搜索商品名');
    fireEvent.change(searchInput, { target: { value: '商品A' } });

    // 过滤后仍能看到商品A
    expect(screen.getAllByText('商品A').length).toBeGreaterThanOrEqual(1);
    // 商品B 在过滤后的数据中不应该存在
    expect(screen.queryByText('¥ 25.00')).not.toBeInTheDocument();
  });
});

