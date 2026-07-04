// ============================================================================
// 防腐层 (ACL) — 规范模型类型定义
//
// 这些类型是集成层使用的"规范模型"(Canonical Model)，
// 用于在外部系统和领域模型之间建立防腐层。
// 外部系统差异在 ACL 中通过字段映射/编码转换翻译为规范模型。
// ============================================================================

/** 基础元数据 — 所有规范模型共享 */
export interface CanonicalBase {
  /** 来源系统编码, 如 'ERP', 'WMS_OLD' */
  sourceSystem: string;

  /** 外部系统中的记录 ID */
  sourceId: string;

  /** 映射到本系统的记录 ID (ACL 完成映射后填充) */
  mappedId?: string;

  /** 数据哈希 (用于变更检测) */
  hash?: string;

  /** 外部系统中的最后更新时间 */
  sourceUpdatedAt?: string;

  /** 本系统最后同步时间 */
  lastSyncAt: string;

  /** 扩展元数据 */
  metadata?: Record<string, unknown>;
}

// ---- Product (商品/SKU) ----

export interface CanonicalProduct extends CanonicalBase {
  /** SKU 编码 */
  sku: string;

  /** 商品名称 */
  name: string;

  /** 商品描述 */
  description?: string;

  /** 分类路径, 如 "食品/调味品/酱油" */
  categoryPath?: string;

  /** 品牌 */
  brand?: string;

  /** 计量单位 (规范编码) */
  unit: string;

  /** 条码 (EAN-13 / UPC / GTIN) */
  barcode?: string;

  /** 是否启用 */
  active: boolean;

  /** 规格属性 */
  specAttributes?: CanonicalSpecAttribute[];

  /** 图片 URL */
  images?: string[];
}

export interface CanonicalSpecAttribute {
  name: string;
  value: string;
  sortOrder?: number;
}

// ---- Batch (批次) ----

export interface CanonicalBatch extends CanonicalBase {
  /** 批次号 */
  batchNo: string;

  /** 关联商品 SKU */
  productSku: string;

  /** 生产日期 (ISO 8601) */
  productionDate?: string;

  /** 有效期/到期日 (ISO 8601) */
  expiryDate?: string;

  /** 保质期 (天) */
  shelfLifeDays?: number;

  /** 批次状态 */
  status: CanonicalBatchStatus;

  /** 供应商 */
  supplier?: string;

  /** 外部批次号 */
  externalBatchNo?: string;
}

export type CanonicalBatchStatus = 'ACTIVE' | 'EXPIRED' | 'QUARANTINED' | 'RECALLED' | 'UNKNOWN';

// ---- StockMovement (库存流水) ----

export interface CanonicalStockMovement extends CanonicalBase {
  /** 移动类型 */
  movementType: CanonicalMovementType;

  /** 商品 SKU */
  productSku: string;

  /** 批次号 */
  batchNo?: string;

  /** 来源库位编码 */
  fromLocationCode?: string;

  /** 目标库位编码 */
  toLocationCode?: string;

  /** 移动数量 (正数) */
  quantity: number;

  /** 计量单位 */
  unit: string;

  /** 移动单价 */
  unitPrice?: number;

  /** 单据类型, 如 'PO' | 'SO' | 'TRANSFER' | 'ADJUSTMENT' */
  referenceType: string;

  /** 单据编号 */
  referenceNo: string;

  /** 业务发生时间 (ISO 8601) */
  occurredAt: string;
}

export type CanonicalMovementType =
  | 'RECEIPT'
  | 'SHIPMENT'
  | 'TRANSFER'
  | 'ADJUSTMENT_PLUS'
  | 'ADJUSTMENT_MINUS';

// ---- InventoryBalance (库存余额) ----

export interface CanonicalInventoryBalance extends CanonicalBase {
  /** 商品 SKU */
  productSku: string;

  /** 库位编码 */
  locationCode: string;

  /** 批次号 */
  batchNo: string;

  /** 现存量 */
  quantityOnHand: number;

  /** 预占量 */
  quantityReserved: number;

  /** 可用量 = onHand - reserved */
  quantityAvailable: number;

  /** 计量单位 */
  unit: string;

  /** 最后变动时间 */
  lastMovementAt?: string;

  /** 版本号 (乐观锁) */
  version: number;
}

// ---- PriceList (价目表) ----

export interface CanonicalPriceList extends CanonicalBase {
  /** 价目表编码 */
  code: string;

  /** 价目表名称 */
  name: string;

  /** 价目表类型 */
  type: CanonicalPriceListType;

  /** 货币代码 (ISO 4217) */
  currency: string;

  /** 是否启用 */
  active: boolean;

  /** 有效期开始 (ISO 8601) */
  validFrom?: string;

  /** 有效期结束 (ISO 8601) */
  validTo?: string;

  /** 价格条目 */
  items?: CanonicalProductPrice[];
}

export type CanonicalPriceListType = 'STANDARD' | 'PROMOTION' | 'CONTRACT';

export interface CanonicalProductPrice {
  /** 商品 SKU */
  productSku: string;

  /** 单价 */
  unitPrice: number;

  /** 税率 */
  taxRate?: number;

  /** 起订量 */
  minQuantity?: number;

  /** 货币 */
  currency: string;

  /** 有效期开始 (ISO 8601) */
  validFrom?: string;

  /** 有效期结束 (ISO 8601) */
  validTo?: string;

  /** 优先级 (值越大优先级越高) */
  priority: number;
}
