import client from './client';

/* ------------------------------------------------------------------ */
/*  类型定义                                                            */
/* ------------------------------------------------------------------ */

export interface Product {
  id: string;
  name: string;
  category: string;
  currentPrice: number;
  unit: string;
}

export interface PriceListItem {
  id: string;
  productId: string;
  productName: string;
  category: string;
  currentPrice: number;
  priceList: string;
  effectiveDate: string;
}

export interface AdjustPriceRequest {
  productId: string;
  newPrice: number;
  effectiveDate: string;
  reason: string;
}

export interface BatchAdjustPriceRequest {
  category?: string;
  productIds?: string[];
  adjustType: 'fixed' | 'percentage';
  adjustValue: number;
  effectiveDate: string;
  reason: string;
}

export interface PriceAdjustmentRecord {
  id: string;
  productId: string;
  productName: string;
  category: string;
  oldPrice: number;
  newPrice: number;
  operator: string;
  reason: string;
  createdAt: string;
  effectiveDate: string;
}

export interface HistoryQuery {
  productId?: string;
  startDate?: string;
  endDate?: string;
}

/* ------------------------------------------------------------------ */
/*  Pricing API                                                        */
/* ------------------------------------------------------------------ */

export const pricingApi = {
  /** GET /api/pricing — 获取价目表列表 */
  list: () => client.get<PriceListItem[]>('/pricing'),

  /** GET /api/products — 获取商品列表（用于表单选择） */
  listProducts: () => client.get<Product[]>('/products'),

  /** POST /api/pricing/adjust — 单品调价 */
  adjust: (data: AdjustPriceRequest) =>
    client.post<PriceAdjustmentRecord>('/pricing/adjust', data),

  /** POST /api/pricing/batch-adjust — 批量调价 */
  batchAdjust: (data: BatchAdjustPriceRequest) =>
    client.post<PriceAdjustmentRecord[]>('/pricing/batch-adjust', data),

  /** GET /api/pricing/history — 调价历史 */
  history: (params?: HistoryQuery) =>
    client.get<PriceAdjustmentRecord[]>('/pricing/history', { params }),
};
