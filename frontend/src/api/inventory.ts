import client from './client';

/* ------------------------------------------------------------------ */
/*  类型定义                                                            */
/* ------------------------------------------------------------------ */

/* --- 仓库 & 库位 --- */
export interface Warehouse {
  id: string;
  name: string;
  code: string;
}

export interface Location {
  id: string;
  warehouseId: string;
  warehouseName?: string;
  code: string;
  name: string;
  isActive: boolean;
}

/* --- 商品 --- */
export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  unit: string;
  currentPrice: number;
}

/* --- 批次 --- */
export interface Batch {
  id: string;
  productId: string;
  productName?: string;
  batchNo: string;
  expiryDate: string;
  manufactureDate: string;
  quantity: number;
  locationId?: string;
  locationName?: string;
}

/* --- 库存查询 --- */
export interface InventoryItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  category: string;
  batchNo: string;
  expiryDate: string;
  locationId: string;
  locationName: string;
  warehouseId: string;
  warehouseName: string;
  quantity: number;
  unit: string;
  updatedAt: string;
}

/* --- 入库单 --- */
export interface InboundOrderItem {
  productId: string;
  batchNo: string;
  expiryDate: string;
  manufactureDate: string;
  locationId: string;
  quantity: number;
}

export interface InboundOrderRequest {
  warehouseId: string;
  items: InboundOrderItem[];
  remark?: string;
}

/* --- 出库单 --- */
export interface OutboundOrderItem {
  productId: string;
  batchId: string;
  locationId: string;
  quantity: number;
}

export interface OutboundOrderRequest {
  warehouseId: string;
  items: OutboundOrderItem[];
  remark?: string;
}

/* --- 调拨单 --- */
export interface TransferOrderItem {
  productId: string;
  batchId: string;
  quantity: number;
}

export interface TransferOrderRequest {
  sourceWarehouseId: string;
  sourceLocationId: string;
  targetWarehouseId: string;
  targetLocationId: string;
  items: TransferOrderItem[];
  remark?: string;
}

/* --- 盘点 --- */
export interface StocktakeItem {
  locationId: string;
  productId: string;
  batchId: string;
  actualQuantity: number;
}

export interface StocktakeRequest {
  warehouseId: string;
  locationId: string;
  items: StocktakeItem[];
  remark?: string;
}

/* --- FEFO 批次建议 --- */
export interface FefoBatchSuggestion {
  batchId: string;
  batchNo: string;
  productId: string;
  productName: string;
  expiryDate: string;
  availableQuantity: number;
  suggestedQuantity: number;
  locationId: string;
  locationName: string;
}

/* ------------------------------------------------------------------ */
/*  Inventory API                                                      */
/* ------------------------------------------------------------------ */

export const inventoryApi = {
  /** GET /api/inventory — 库存查询（支持多条件过滤 + 分页） */
  list: (params?: Record<string, string | number | undefined>) =>
    client.get<{ records: InventoryItem[]; total: number }>('/inventory', {
      params,
    }),

  /** GET /api/warehouses — 仓库列表 */
  listWarehouses: () => client.get<Warehouse[]>('/warehouses'),

  /** GET /api/locations?warehouseId=xxx — 库位列表 */
  listLocations: (warehouseId?: string) =>
    client.get<Location[]>('/locations', {
      params: warehouseId ? { warehouseId } : undefined,
    }),

  /** GET /api/products — 商品列表（含 sku） */
  listProducts: () => client.get<Product[]>('/products'),

  /** GET /api/batches — 批次列表（支持按商品/库位过滤, 按过期日排序用于 FEFO） */
  listBatches: (params?: Record<string, string | number | undefined>) =>
    client.get<Batch[]>('/batches', { params }),

  /** GET /api/batches/fefo-suggestions?productId=xxx&warehouseId=xxx — FEFO 批次建议 */
  getFefoSuggestions: (productId: string, warehouseId: string, quantity?: number) =>
    client.get<FefoBatchSuggestion[]>('/batches/fefo-suggestions', {
      params: { productId, warehouseId, quantity },
    }),

  /** POST /api/inbound — 创建入库单 */
  createInbound: (data: InboundOrderRequest) =>
    client.post('/inbound', data),

  /** POST /api/outbound — 创建出库单 */
  createOutbound: (data: OutboundOrderRequest) =>
    client.post('/outbound', data),

  /** POST /api/transfer — 创建调拨单 */
  createTransfer: (data: TransferOrderRequest) =>
    client.post('/transfer', data),

  /** POST /api/stocktake — 提交盘点 */
  createStocktake: (data: StocktakeRequest) =>
    client.post('/stocktake', data),
};
