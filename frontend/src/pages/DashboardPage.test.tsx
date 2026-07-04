import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { AuthProvider } from '../contexts/AuthContext';
import DashboardPage from './DashboardPage';

/* ------------------------------------------------------------------ */
/*  Mock dashboard API                                                 */
/* ------------------------------------------------------------------ */

const mockOverview = vi.fn();
const mockNearExpiry = vi.fn();
const mockValuation = vi.fn();
const mockTrends = vi.fn();

vi.mock('../api/dashboard', () => ({
  dashboardApi: {
    overview: (...args: unknown[]) => mockOverview(...args),
    nearExpiry: (...args: unknown[]) => mockNearExpiry(...args),
    valuation: (...args: unknown[]) => mockValuation(...args),
    trends: (...args: unknown[]) => mockTrends(...args),
  },
}));

/* ------------------------------------------------------------------ */
/*  Mock data                                                          */
/* ------------------------------------------------------------------ */

const MOCK_OVERVIEW = {
  totalProducts: 128,
  totalInventory: 45680,
  nearExpiryCount: 9,
  lowStockCount: 5,
};

const MOCK_NEAR_EXPIRY = [
  { id: 'B001', productName: '鲜牛奶', warehouseName: '一号冷库', quantity: 200, unit: '箱', expiryDate: '2026-07-10', daysUntilExpiry: 6 },
  { id: 'B002', productName: '酸奶', warehouseName: '一号冷库', quantity: 150, unit: '箱', expiryDate: '2026-07-12', daysUntilExpiry: 8 },
  { id: 'B003', productName: '面包', warehouseName: '常温仓', quantity: 80, unit: '袋', expiryDate: '2026-07-08', daysUntilExpiry: 4 },
  { id: 'B007', productName: '蛋糕', warehouseName: '一号冷库', quantity: 40, unit: '个', expiryDate: '2026-07-07', daysUntilExpiry: 3 },
];

const MOCK_VALUATION = {
  byWarehouse: [
    { warehouse: '一号冷库', value: 285000 },
    { warehouse: '二号冷库', value: 192000 },
  ],
  byCategory: [
    { category: '乳制品', value: 165000 },
    { category: '肉类', value: 142000 },
  ],
};

const MOCK_TRENDS = [
  { date: '07-01', inQuantity: 1200, outQuantity: 980 },
  { date: '07-02', inQuantity: 980, outQuantity: 1050 },
];

/* ------------------------------------------------------------------ */
/*  测试辅助                                                            */
/* ------------------------------------------------------------------ */

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <ConfigProvider locale={zhCN}>
        <AuthProvider>
          <DashboardPage />
        </AuthProvider>
      </ConfigProvider>
    </MemoryRouter>,
  );
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('DashboardPage', () => {
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

    mockOverview.mockResolvedValue({ data: MOCK_OVERVIEW });
    mockNearExpiry.mockResolvedValue({ data: MOCK_NEAR_EXPIRY });
    mockValuation.mockResolvedValue({ data: MOCK_VALUATION });
    mockTrends.mockResolvedValue({ data: MOCK_TRENDS });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('渲染页面标题和四张总览卡片', async () => {
    renderDashboard();
    expect(screen.getByText('首页仪表盘')).toBeInTheDocument();
    expect(screen.getByText('总商品数')).toBeInTheDocument();
    expect(screen.getByText('总库存量')).toBeInTheDocument();
    expect(screen.getByText('临期批次数')).toBeInTheDocument();
    expect(screen.getByText('低库存预警')).toBeInTheDocument();
  });

  it('调用 API 并渲染统计数值', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(mockOverview).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText('128')).toBeInTheDocument();
    });
    expect(screen.getByText('45,680')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('渲染临期预警表格', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(mockNearExpiry).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText('鲜牛奶')).toBeInTheDocument();
    });
    expect(screen.getByText('面包')).toBeInTheDocument();
    expect(screen.getByText('蛋糕')).toBeInTheDocument();

    // 倒计时标签
    expect(screen.getByText('6 天')).toBeInTheDocument();
    expect(screen.getByText('3 天')).toBeInTheDocument();

    // 紧急标签 (<=3天)
    expect(screen.getByText('1 批紧急')).toBeInTheDocument();
  });

  it('渲染库存估值汇总（按仓库 + 按品类）', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(mockValuation).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText('按仓库估值')).toBeInTheDocument();
    });
    expect(screen.getByText('按品类估值')).toBeInTheDocument();

    // 仓库估值数据 (使用 getAllByText 因为一号冷库也出现在临期表格中)
    const warehouseElements = screen.getAllByText('一号冷库');
    expect(warehouseElements.length).toBeGreaterThanOrEqual(2);

    // 二号冷库只出现在估值表中
    expect(screen.getByText('二号冷库')).toBeInTheDocument();

    // 品类估值数据
    expect(screen.getByText('乳制品')).toBeInTheDocument();
    expect(screen.getByText('肉类')).toBeInTheDocument();

    // 合计 (477,000 = 285000 + 192000)
    expect(screen.getByText('合计：¥ 477,000')).toBeInTheDocument();
  });

  it('渲染出入库趋势表格和粒度切换器', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(mockTrends).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText('出入库趋势')).toBeInTheDocument();
    });

    // 粒度切换器
    expect(screen.getByText('按日')).toBeInTheDocument();
    expect(screen.getByText('按周')).toBeInTheDocument();
    expect(screen.getByText('按月')).toBeInTheDocument();

    // 趋势数据
    expect(screen.getByText('07-01')).toBeInTheDocument();
    expect(screen.getByText('07-02')).toBeInTheDocument();

    // 入库/出库表头 (使用 getAllByText 因为 Ant Table 有 hidden cells)
    const inHeaders = screen.getAllByText('入库量');
    expect(inHeaders.length).toBeGreaterThanOrEqual(1);
    const outHeaders = screen.getAllByText('出库量');
    expect(outHeaders.length).toBeGreaterThanOrEqual(1);
  });

  it('API 失败时静默降级使用 mock 数据', async () => {
    mockOverview.mockRejectedValue(new Error('Network error'));
    mockNearExpiry.mockRejectedValue(new Error('Network error'));
    mockValuation.mockRejectedValue(new Error('Network error'));
    mockTrends.mockRejectedValue(new Error('Network error'));

    renderDashboard();

    // 即使 API 失败，页面仍应使用 mock 初始值渲染
    await waitFor(() => {
      expect(screen.getByText('总商品数')).toBeInTheDocument();
    });
    expect(screen.getByText('临期预警 — 即将过期批次')).toBeInTheDocument();
    expect(screen.getByText('按仓库估值')).toBeInTheDocument();
    expect(screen.getByText('出入库趋势')).toBeInTheDocument();
  });
});
