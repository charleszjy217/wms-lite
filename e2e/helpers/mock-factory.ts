// ============================================================================
// Shared mock data factories for e2e tests
// ============================================================================

import type { Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// Type helpers
// ---------------------------------------------------------------------------

export type MockPrisma = {
  $transaction: ReturnType<typeof vi.fn>;
  $queryRawUnsafe: ReturnType<typeof vi.fn>;
  $executeRawUnsafe: ReturnType<typeof vi.fn>;
  user: {
    findFirst: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  role: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  product: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  productCategory: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  warehouse: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  location: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  zone: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  batch: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  receivingOrder: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  receivingOrderItem: {
    update: ReturnType<typeof vi.fn>;
  };
  shippingOrder: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  shippingOrderItem: Record<string, ReturnType<typeof vi.fn>>;
  transferOrder: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  transferItem: Record<string, ReturnType<typeof vi.fn>>;
  stocktakeOrder: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  stocktakeItem: {
    update: ReturnType<typeof vi.fn>;
  };
  stockMovement: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  inventoryBalance: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    groupBy: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
  };
  auditLog: {
    create: ReturnType<typeof vi.fn>;
  };
  priceList: {
    findUnique: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  productPrice: {
    findUnique: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  priceChangeLog: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  integrationEndpoint: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  syncJob: {
    create: ReturnType<typeof vi.fn>;
  };
};

export type MockTx = {
  batch: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  receivingOrder: {
    update: ReturnType<typeof vi.fn>;
  };
  receivingOrderItem: {
    update: ReturnType<typeof vi.fn>;
  };
  shippingOrder: {
    update: ReturnType<typeof vi.fn>;
  };
  stockMovement: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  inventoryBalance: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  auditLog: {
    create: ReturnType<typeof vi.fn>;
  };
  $queryRawUnsafe: ReturnType<typeof vi.fn>;
  $executeRawUnsafe: ReturnType<typeof vi.fn>;
  stocktakeItem: {
    update: ReturnType<typeof vi.fn>;
  };
  stocktakeOrder: {
    update: ReturnType<typeof vi.fn>;
  };
  transferOrder: {
    update: ReturnType<typeof vi.fn>;
  };
};

// ---------------------------------------------------------------------------
// Shared IDs
// ---------------------------------------------------------------------------

export const IDS = {
  userId: 'user-e2e-1',
  roleId: 'role-e2e-1',
  productId: 'prod-e2e-1',
  categoryId: 'cat-e2e-1',
  warehouseId: 'wh-e2e-1',
  zoneId: 'zone-e2e-1',
  locationId: 'loc-e2e-1',
  batchId: 'batch-e2e-1',
  batchId2: 'batch-e2e-2',
  priceListId: 'pl-e2e-1',
  productPriceId: 'pp-e2e-1',
  integrationEndpointId: 'ie-e2e-1',
  receivingOrderId: 'ro-e2e-1',
  shippingOrderId: 'so-e2e-1',
  transferOrderId: 'tr-e2e-1',
  stocktakeOrderId: 'st-e2e-1',
} as const;

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

export const NOW = new Date('2026-07-04T12:00:00Z');
export const FUTURE_DATE = new Date('2026-08-15T12:00:00Z');
export const EXPIRED_DATE = new Date('2026-06-01T12:00:00Z');

// ---------------------------------------------------------------------------
// Entity factories
// ---------------------------------------------------------------------------

export const mockRole = () => ({
  id: IDS.roleId,
  code: 'OPERATOR',
  name: '仓库操作员',
  description: null,
  createdAt: NOW,
  updatedAt: NOW,
});

export const mockUser = (overrides: Record<string, unknown> = {}) => ({
  id: IDS.userId,
  username: 'testuser',
  email: 'test@example.com',
  password: 'hashed-password',
  displayName: 'Test User',
  status: 'ACTIVE',
  createdAt: NOW,
  updatedAt: NOW,
  userRoles: [
    {
      id: 'ur-1',
      userId: IDS.userId,
      roleId: IDS.roleId,
      role: mockRole(),
    },
  ],
  ...overrides,
});

export const mockProductCategory = () => ({
  id: IDS.categoryId,
  code: 'CAT-01',
  name: '测试分类',
  parentId: null,
  path: 'CAT-01',
  createdAt: NOW,
  updatedAt: NOW,
});

export const mockProduct = (overrides: Record<string, unknown> = {}) => ({
  id: IDS.productId,
  skuCode: 'SKU-E2E-001',
  name: '端到端测试商品',
  description: '用于端到端测试',
  categoryId: IDS.categoryId,
  brand: 'TestBrand',
  unitOfMeasure: 'PCS',
  barcode: '6901234567890',
  specifications: null,
  status: 'ACTIVE',
  createdAt: NOW,
  updatedAt: NOW,
  category: mockProductCategory(),
  ...overrides,
});

export const mockWarehouse = () => ({
  id: IDS.warehouseId,
  code: 'WH-E2E-01',
  name: '端到端测试仓库',
  type: 'PHYSICAL',
  address: '测试地址',
  status: 'ACTIVE',
  createdAt: NOW,
  updatedAt: NOW,
});

export const mockZone = () => ({
  id: IDS.zoneId,
  code: 'ZONE-E2E-A',
  name: 'E2E A区',
  warehouseId: IDS.warehouseId,
  status: 'ACTIVE',
  createdAt: NOW,
  updatedAt: NOW,
});

export const mockLocation = (overrides: Record<string, unknown> = {}) => ({
  id: IDS.locationId,
  warehouseId: IDS.warehouseId,
  zoneId: IDS.zoneId,
  area: 'A',
  aisle: '01',
  rack: 'R01',
  level: 'L1',
  position: 'P1',
  code: 'LOC-E2E-A01R01L1P1',
  barcode: null,
  status: 'ACTIVE',
  maxCapacity: 1000,
  zone: mockZone(),
  warehouse: mockWarehouse(),
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
});

export const mockBatch = (overrides: Record<string, unknown> = {}) => ({
  id: IDS.batchId,
  batchNo: 'BATCH-E2E-001',
  productId: IDS.productId,
  productionDate: new Date('2026-06-01'),
  expiryDate: FUTURE_DATE,
  status: 'ACTIVE',
  createdAt: NOW,
  updatedAt: NOW,
  product: mockProduct(),
  ...overrides,
});

export const mockBatch2 = (overrides: Record<string, unknown> = {}) => ({
  id: IDS.batchId2,
  batchNo: 'BATCH-E2E-002',
  productId: IDS.productId,
  productionDate: new Date('2026-06-15'),
  expiryDate: EXPIRED_DATE,
  status: 'EXPIRED',
  createdAt: NOW,
  updatedAt: NOW,
  product: mockProduct(),
  ...overrides,
});

export const mockInventoryBalance = (overrides: Record<string, unknown> = {}) => ({
  id: 'ib-e2e-1',
  productId: IDS.productId,
  locationId: IDS.locationId,
  batchId: IDS.batchId,
  quantity: 100,
  product: {
    id: IDS.productId,
    skuCode: 'SKU-E2E-001',
    name: '端到端测试商品',
    unitOfMeasure: 'PCS',
  },
  location: {
    id: IDS.locationId,
    area: 'A',
    aisle: '01',
    rack: 'R01',
    level: 'L1',
    position: 'P1',
    warehouse: { id: IDS.warehouseId, code: 'WH-E2E-01', name: '端到端测试仓库' },
  },
  batch: {
    id: IDS.batchId,
    batchNo: 'BATCH-E2E-001',
    expiryDate: FUTURE_DATE,
    status: 'ACTIVE',
  },
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
});

export const mockPriceList = () => ({
  id: IDS.priceListId,
  code: 'PL-E2E-001',
  name: 'E2E测试价目表',
  status: 'ACTIVE',
  createdAt: NOW,
  updatedAt: NOW,
});

export const mockProductPrice = (overrides: Record<string, unknown> = {}) => ({
  id: IDS.productPriceId,
  priceListId: IDS.priceListId,
  productId: IDS.productId,
  unitPrice: 100.00,
  effectiveDate: NOW,
  endDate: null,
  product: mockProduct(),
  priceList: mockPriceList(),
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
});

// ---------------------------------------------------------------------------
// Transaction mock factory
// ---------------------------------------------------------------------------

export function createTxMock(): MockTx {
  return {
    batch: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    receivingOrder: {
      update: vi.fn(),
    },
    receivingOrderItem: {
      update: vi.fn(),
    },
    shippingOrder: {
      update: vi.fn(),
    },
    stockMovement: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    inventoryBalance: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $queryRawUnsafe: vi.fn(),
    $executeRawUnsafe: vi.fn(),
    stocktakeItem: {
      update: vi.fn(),
    },
    stocktakeOrder: {
      update: vi.fn(),
    },
    transferOrder: {
      update: vi.fn(),
    },
  };
}

// ---------------------------------------------------------------------------
// Mock Prisma factory
// ---------------------------------------------------------------------------

export function createMockPrisma(): MockPrisma {
  return {
    $transaction: vi.fn(),
    $queryRawUnsafe: vi.fn(),
    $executeRawUnsafe: vi.fn(),
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    role: {
      findUnique: vi.fn(),
    },
    product: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    productCategory: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    warehouse: {
      findUnique: vi.fn(),
    },
    location: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    zone: {
      findUnique: vi.fn(),
    },
    batch: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    receivingOrder: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    receivingOrderItem: {
      update: vi.fn(),
    },
    shippingOrder: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    shippingOrderItem: {},
    transferOrder: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    transferItem: {},
    stocktakeOrder: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    stocktakeItem: {
      update: vi.fn(),
    },
    stockMovement: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    inventoryBalance: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      groupBy: vi.fn(),
      findFirst: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    priceList: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    productPrice: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    priceChangeLog: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    integrationEndpoint: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    syncJob: {
      create: vi.fn(),
    },
  };
}
