import client from './client';

/* ------------------------------------------------------------------ */
/*  类型定义                                                            */
/* ------------------------------------------------------------------ */

/** 库存总览卡片数据 */
export interface DashboardOverview {
  totalProducts: number;
  totalInventory: number;
  nearExpiryCount: number;
  lowStockCount: number;
}

/** 临期批次条目 */
export interface NearExpiryBatch {
  id: string;
  productName: string;
  warehouseName: string;
  quantity: number;
  unit: string;
  expiryDate: string;
  daysUntilExpiry: number;
}

/** 库存估值汇总 */
export interface InventoryValuation {
  byWarehouse: { warehouse: string; value: number }[];
  byCategory: { category: string; value: number }[];
}

/** 出入库趋势数据点 */
export interface TrendItem {
  date: string;
  inQuantity: number;
  outQuantity: number;
}

export type TrendGranularity = 'day' | 'week' | 'month';

/* ------------------------------------------------------------------ */
/*  Dashboard API                                                      */
/* ------------------------------------------------------------------ */

export const dashboardApi = {
  /** GET /api/dashboard/overview — 库存总览 */
  overview: () => client.get<DashboardOverview>('/dashboard/overview'),

  /** GET /api/dashboard/near-expiry — 临期批次列表 */
  nearExpiry: () => client.get<NearExpiryBatch[]>('/dashboard/near-expiry'),

  /** GET /api/dashboard/valuation — 库存估值汇总 */
  valuation: () => client.get<InventoryValuation>('/dashboard/valuation'),

  /** GET /api/dashboard/trends — 出入库趋势 */
  trends: (granularity: TrendGranularity = 'day') =>
    client.get<TrendItem[]>('/dashboard/trends', { params: { granularity } }),
};
