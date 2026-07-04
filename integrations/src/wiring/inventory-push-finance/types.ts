// ============================================================================
// InventoryPushFinanceLink — 类型定义
// ============================================================================

import type { EndpointConfig } from '../../config/types.js';

/** 库存变动推送载荷 */
export interface InventoryPushPayload {
  eventType: string;
  occurredAt: string;
  movement: {
    movementId: string;
    movementType: string;
    productSku: string;
    productName: string;
    batchNo?: string;
    fromLocationCode?: string;
    toLocationCode?: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    referenceType: string;
    referenceNo: string;
    operator: string;
  };
  valuation: {
    totalValue: number;
    currency: string;
    valuationMethod: string;
  };
}

/** 库存变动事件数据 */
export interface StockMovementEvent {
  movementId: string;
  movementType: string;
  productSku: string;
  productName: string;
  batchNo?: string;
  fromLocationCode?: string;
  toLocationCode?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  referenceType: string;
  referenceNo: string;
  operator: string;
  occurredAt: string;
}

/** 推送结果 */
export interface PushResult {
  endpointId: string;
  movementId: string;
  success: boolean;
  statusCode?: number;
  error?: string;
  completedAt: string;
}

/** 财务系统响应 */
export interface FinanceApiResponse {
  code: number;
  message: string;
  data?: {
    receiptId: string;
    status: string;
  };
}

/** 库存推送链路配置 */
export interface InventoryPushFinanceLinkConfig {
  endpoint: EndpointConfig;
  currency?: string;
  valuationMethod?: string;
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}
