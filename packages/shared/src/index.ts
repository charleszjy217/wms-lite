// WMS-lite Shared Types & Constants

// === Product ===
export interface Product {
  id: string;
  skuCode: string;
  name: string;
  description?: string;
  category?: ProductCategory;
  brand?: string;
  unitOfMeasure: string;
  barcode?: string;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
}

export type ProductStatus = 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED' | 'UNKNOWN';

export interface ProductCategory {
  id: string;
  code: string;
  name: string;
  parentId?: string;
  path: string;
}

// === Warehouse ===
export interface Warehouse {
  id: string;
  code: string;
  name: string;
  type: WarehouseType;
  address?: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export type WarehouseType = 'PHYSICAL' | 'VIRTUAL';

export interface Location {
  id: string;
  warehouseId: string;
  area: string;
  aisle: string;
  rack: string;
  level: string;
  position: string;
  barcode?: string;
  status: 'ACTIVE' | 'LOCKED' | 'INACTIVE';
  maxCapacity?: number;
}

// === Batch ===
export interface Batch {
  id: string;
  batchNo: string;
  productId: string;
  productionDate: string;
  expiryDate: string;
  shelfLifeDays: number;
  status: BatchStatus;
  supplier?: string;
  externalBatchNo?: string;
  createdAt: string;
  updatedAt: string;
}

export type BatchStatus = 'ACTIVE' | 'EXPIRED' | 'QUARANTINED' | 'RECALLED';

export interface BatchExpiryInfo {
  batchId: string;
  daysUntilExpiry: number;
  warningLevel: 'NORMAL' | 'WARNING' | 'CRITICAL' | 'EXPIRED';
}

// === Inventory ===
export interface StockMovement {
  id: string;
  movementType: MovementType;
  productId: string;
  batchId?: string;
  fromLocationId?: string;
  toLocationId?: string;
  quantity: number;
  quantityDelta: number;
  unitOfMeasure: string;
  unitPrice?: number;
  totalAmount?: number;
  referenceType: string;
  referenceNo: string;
  operatorId: string;
  reason?: string;
  occurredAt: string;
  recordedAt: string;
}

export type MovementType =
  | 'RECEIPT'
  | 'SHIPMENT'
  | 'TRANSFER'
  | 'ADJUSTMENT_PLUS'
  | 'ADJUSTMENT_MINUS';

export interface InventoryBalance {
  id: string;
  productId: string;
  locationId: string;
  batchId: string;
  quantityOnHand: number;
  quantityReserved: number;
  quantityAvailable: number;
  unitOfMeasure: string;
  lastMovementAt?: string;
  version: number;
}

// === Pricing ===
export interface PriceList {
  id: string;
  code: string;
  name: string;
  type: PriceListType;
  currency: string;
  status: 'ACTIVE' | 'INACTIVE';
  validFrom?: string;
  validTo?: string;
}

export type PriceListType = 'STANDARD' | 'PROMOTION' | 'CONTRACT';

export interface ProductPrice {
  id: string;
  priceListId: string;
  productId: string;
  unitPrice: number;
  taxRate?: number;
  minQuantity?: number;
  currency: string;
  validFrom?: string;
  validTo?: string;
  priority: number;
}

// === Auth ===
export interface User {
  id: string;
  username: string;
  email: string;
  displayName: string;
  status: 'ACTIVE' | 'DISABLED';
  roles: Role[];
}

export interface Role {
  id: string;
  code: string;
  name: string;
  permissions: Permission[];
}

export interface Permission {
  code: string;
  resource: string;
  action: 'create' | 'read' | 'update' | 'delete' | 'approve' | 'export';
  constraints?: Record<string, unknown>;
}

// === Audit ===
export interface AuditLog {
  id: string;
  entityType: string;
  entityId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'SYNC';
  operatorId: string;
  operatorIp?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  timestamp: string;
  traceId?: string;
}
