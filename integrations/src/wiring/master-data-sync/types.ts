// ============================================================================
// MasterDataSyncLink — 类型定义
// ============================================================================

import type { EndpointConfig } from '../../config/types.js';

/** 外部商品记录（ERP 系统原始格式） */
export interface ExternalProduct {
  id: string;
  sku: string;
  name: string;
  description?: string;
  category?: string;
  categoryPath?: string;
  brand?: string;
  unit: string;
  barcode?: string;
  active: boolean;
  specAttributes?: ExternalSpecAttribute[];
  images?: string[];
  updatedAt: string;
}

/** 外部规格属性 */
export interface ExternalSpecAttribute {
  name: string;
  value: string;
  sortOrder?: number;
}

/** 外部供应商记录 */
export interface ExternalSupplier {
  id: string;
  code: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  active: boolean;
  updatedAt: string;
}

/** 外部 API 分页响应 */
export interface PaginatedResponse<T> {
  code: number;
  message: string;
  data: {
    items: T[];
    pagination: {
      page: number;
      size: number;
      totalItems: number;
      totalPages: number;
    };
  };
}

/** 同步结果 */
export interface SyncResult {
  endpointId: string;
  recordsProcessed: number;
  recordsFailed: number;
  errors: string[];
  completedAt: string;
}

/** 主数据同步链路配置 */
export interface MasterDataSyncLinkConfig {
  endpoint: EndpointConfig;
  schedule?: string;
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}
