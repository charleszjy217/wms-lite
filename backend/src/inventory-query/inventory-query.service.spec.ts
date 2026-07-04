import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InventoryQueryService } from './inventory-query.service';
import { PrismaService } from '../prisma/prisma.service';

// ---------------------------------------------------------------------------
// Types for mocked Prisma
// ---------------------------------------------------------------------------
type MockPrisma = {
  inventoryBalance: {
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    groupBy: ReturnType<typeof vi.fn>;
  };
  stockMovement: {
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  batch: {
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  priceList: {
    findFirst: ReturnType<typeof vi.fn>;
  };
  productPrice: {
    findMany: ReturnType<typeof vi.fn>;
  };
  product: {
    findMany: ReturnType<typeof vi.fn>;
  };
  location: {
    findMany: ReturnType<typeof vi.fn>;
  };
};

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------
const now = new Date('2026-07-04T12:00:00Z');
const productId = 'prod-1';
const productId2 = 'prod-2';
const locationId = 'loc-1';
const locationId2 = 'loc-2';
const batchId = 'batch-1';
const warehouseId = 'wh-1';
const categoryId = 'cat-1';

const mockProduct = {
  id: productId,
  skuCode: 'SKU-001',
  name: '测试商品A',
  unitOfMeasure: 'PCS',
  categoryId,
  category: { id: categoryId, code: 'CAT-01', name: '测试分类' },
};

const mockProduct2 = {
  id: productId2,
  skuCode: 'SKU-002',
  name: '测试商品B',
  unitOfMeasure: 'KG',
  categoryId: null,
  category: null,
};

const mockWarehouse = {
  id: warehouseId,
  code: 'WH-01',
  name: '主仓库',
};

const mockLocation = {
  id: locationId,
  area: 'A区',
  aisle: 'A',
  rack: '01',
  level: '1',
  position: '01',
  warehouse: mockWarehouse,
};

const mockLocation2 = {
  id: locationId2,
  area: 'B区',
  aisle: 'B',
  rack: '02',
  level: '2',
  position: '02',
  warehouse: mockWarehouse,
};

const mockBatch = {
  id: batchId,
  batchNo: 'BATCH-001',
  expiryDate: new Date('2026-08-15T12:00:00Z'),
  status: 'ACTIVE',
};

const mockBalance = (overrides: Record<string, unknown> = {}) => ({
  id: 'ib-1',
  productId,
  locationId,
  batchId,
  quantity: 100,
  product: mockProduct,
  location: mockLocation,
  batch: mockBatch,
  ...overrides,
});

const mockMovement = (overrides: Record<string, unknown> = {}) => ({
  id: 'sm-1',
  type: 'INBOUND',
  productId,
  batchId,
  fromLocationId: null,
  toLocationId: locationId,
  quantity: 50,
  referenceNo: 'REF-001',
  operator: 'admin',
  reason: null,
  createdAt: now,
  product: { id: productId, skuCode: 'SKU-001', name: '测试商品A' },
  batch: { id: batchId, batchNo: 'BATCH-001' },
  fromLocation: null,
  toLocation: mockLocation,
  ...overrides,
});

const mockBatchWithProduct = (overrides: Record<string, unknown> = {}) => ({
  id: batchId,
  batchNo: 'BATCH-001',
  productId,
  productionDate: null,
  expiryDate: new Date('2026-08-15T12:00:00Z'),
  status: 'ACTIVE',
  createdAt: new Date('2026-07-01'),
  updatedAt: new Date('2026-07-01'),
  product: mockProduct,
  inventoryBalances: [
    {
      id: 'ib-1',
      quantity: 100,
      location: mockLocation,
    },
  ],
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('InventoryQueryService', () => {
  let service: InventoryQueryService;
  let prisma: MockPrisma;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);

    prisma = {
      inventoryBalance: {
        findMany: vi.fn(),
        count: vi.fn(),
        groupBy: vi.fn(),
      },
      stockMovement: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
      batch: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
      priceList: {
        findFirst: vi.fn(),
      },
      productPrice: {
        findMany: vi.fn(),
      },
      product: {
        findMany: vi.fn(),
      },
      location: {
        findMany: vi.fn(),
      },
    };

    service = new InventoryQueryService(
      prisma as unknown as PrismaService,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ===========================================================================
  // findBalances
  // ===========================================================================
  describe('findBalances', () => {
    it('should return paginated inventory balances', async () => {
      prisma.inventoryBalance.findMany.mockResolvedValue([mockBalance()]);
      prisma.inventoryBalance.count.mockResolvedValue(1);

      const result = await service.findBalances({ page: 1, limit: 20 });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it('should filter by productId', async () => {
      prisma.inventoryBalance.findMany.mockResolvedValue([]);
      prisma.inventoryBalance.count.mockResolvedValue(0);

      await service.findBalances({ productId });

      expect(prisma.inventoryBalance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ productId }),
        }),
      );
    });

    it('should filter by locationId', async () => {
      prisma.inventoryBalance.findMany.mockResolvedValue([]);
      prisma.inventoryBalance.count.mockResolvedValue(0);

      await service.findBalances({ locationId });

      expect(prisma.inventoryBalance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ locationId }),
        }),
      );
    });

    it('should filter by batchId', async () => {
      prisma.inventoryBalance.findMany.mockResolvedValue([]);
      prisma.inventoryBalance.count.mockResolvedValue(0);

      await service.findBalances({ batchId });

      expect(prisma.inventoryBalance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ batchId }),
        }),
      );
    });

    it('should combine multiple filters', async () => {
      prisma.inventoryBalance.findMany.mockResolvedValue([]);
      prisma.inventoryBalance.count.mockResolvedValue(0);

      await service.findBalances({ productId, locationId, batchId });

      expect(prisma.inventoryBalance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { productId, locationId, batchId },
        }),
      );
    });

    it('should include product, location, and batch relations', async () => {
      prisma.inventoryBalance.findMany.mockResolvedValue([]);
      prisma.inventoryBalance.count.mockResolvedValue(0);

      await service.findBalances({});

      expect(prisma.inventoryBalance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            product: expect.any(Object),
            location: expect.any(Object),
            batch: expect.any(Object),
          }),
        }),
      );
    });

    it('should respect page and limit parameters', async () => {
      prisma.inventoryBalance.findMany.mockResolvedValue([]);
      prisma.inventoryBalance.count.mockResolvedValue(50);

      const result = await service.findBalances({ page: 3, limit: 10 });

      expect(prisma.inventoryBalance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
      expect(result.page).toBe(3);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(5);
    });

    it('should order by productId, locationId, batchId ascending', async () => {
      prisma.inventoryBalance.findMany.mockResolvedValue([]);
      prisma.inventoryBalance.count.mockResolvedValue(0);

      await service.findBalances({});

      expect(prisma.inventoryBalance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ productId: 'asc' }, { locationId: 'asc' }, { batchId: 'asc' }],
        }),
      );
    });

    it('should handle zero results', async () => {
      prisma.inventoryBalance.findMany.mockResolvedValue([]);
      prisma.inventoryBalance.count.mockResolvedValue(0);

      const result = await service.findBalances({});

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });
  });

  // ===========================================================================
  // findMovements
  // ===========================================================================
  describe('findMovements', () => {
    it('should return paginated stock movements', async () => {
      prisma.stockMovement.findMany.mockResolvedValue([mockMovement()]);
      prisma.stockMovement.count.mockResolvedValue(1);

      const result = await service.findMovements({ page: 1, limit: 20 });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it('should filter by type', async () => {
      prisma.stockMovement.findMany.mockResolvedValue([]);
      prisma.stockMovement.count.mockResolvedValue(0);

      await service.findMovements({ type: 'OUTBOUND' });

      expect(prisma.stockMovement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'OUTBOUND' }),
        }),
      );
    });

    it('should filter by productId', async () => {
      prisma.stockMovement.findMany.mockResolvedValue([]);
      prisma.stockMovement.count.mockResolvedValue(0);

      await service.findMovements({ productId });

      expect(prisma.stockMovement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ productId }),
        }),
      );
    });

    it('should filter by batchId', async () => {
      prisma.stockMovement.findMany.mockResolvedValue([]);
      prisma.stockMovement.count.mockResolvedValue(0);

      await service.findMovements({ batchId });

      expect(prisma.stockMovement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ batchId }),
        }),
      );
    });

    it('should filter by date range', async () => {
      prisma.stockMovement.findMany.mockResolvedValue([]);
      prisma.stockMovement.count.mockResolvedValue(0);

      await service.findMovements({
        startDate: '2026-07-01T00:00:00Z',
        endDate: '2026-07-31T00:00:00Z',
      });

      expect(prisma.stockMovement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: new Date('2026-07-01T00:00:00Z'),
              lte: new Date('2026-07-31T00:00:00Z'),
            },
          }),
        }),
      );
    });

    it('should filter by startDate only', async () => {
      prisma.stockMovement.findMany.mockResolvedValue([]);
      prisma.stockMovement.count.mockResolvedValue(0);

      await service.findMovements({ startDate: '2026-07-01T00:00:00Z' });

      expect(prisma.stockMovement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: { gte: new Date('2026-07-01T00:00:00Z') },
          }),
        }),
      );
    });

    it('should filter by endDate only', async () => {
      prisma.stockMovement.findMany.mockResolvedValue([]);
      prisma.stockMovement.count.mockResolvedValue(0);

      await service.findMovements({ endDate: '2026-07-31T00:00:00Z' });

      expect(prisma.stockMovement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: { lte: new Date('2026-07-31T00:00:00Z') },
          }),
        }),
      );
    });

    it('should include product, batch, fromLocation, toLocation relations', async () => {
      prisma.stockMovement.findMany.mockResolvedValue([]);
      prisma.stockMovement.count.mockResolvedValue(0);

      await service.findMovements({});

      expect(prisma.stockMovement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            product: expect.any(Object),
            batch: expect.any(Object),
            fromLocation: expect.any(Object),
            toLocation: expect.any(Object),
          }),
        }),
      );
    });

    it('should order by createdAt descending', async () => {
      prisma.stockMovement.findMany.mockResolvedValue([]);
      prisma.stockMovement.count.mockResolvedValue(0);

      await service.findMovements({});

      expect(prisma.stockMovement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
      );
    });

    it('should handle zero results', async () => {
      prisma.stockMovement.findMany.mockResolvedValue([]);
      prisma.stockMovement.count.mockResolvedValue(0);

      const result = await service.findMovements({});

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should combine all filters', async () => {
      prisma.stockMovement.findMany.mockResolvedValue([]);
      prisma.stockMovement.count.mockResolvedValue(0);

      await service.findMovements({
        type: 'INBOUND',
        productId,
        batchId,
        startDate: '2026-07-01T00:00:00Z',
      });

      expect(prisma.stockMovement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            type: 'INBOUND',
            productId,
            batchId,
            createdAt: { gte: new Date('2026-07-01T00:00:00Z') },
          },
        }),
      );
    });
  });

  // ===========================================================================
  // findExpiryReport
  // ===========================================================================
  describe('findExpiryReport', () => {
    const futureDate = new Date('2026-08-15T12:00:00Z');
    const expiredDate = new Date('2026-06-01T12:00:00Z');
    const nearExpiryDate = new Date('2026-07-20T12:00:00Z'); // 16 days away

    it('should return paginated expiry report', async () => {
      prisma.batch.findMany.mockResolvedValue([
        mockBatchWithProduct({ expiryDate: futureDate }),
      ]);
      prisma.batch.count.mockResolvedValue(1);

      const result = await service.findExpiryReport({
        page: 1,
        limit: 20,
        showExpired: true,
        showNearExpiry: true,
      });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it('should include nearExpiryDays in response', async () => {
      prisma.batch.findMany.mockResolvedValue([]);
      prisma.batch.count.mockResolvedValue(0);

      const result = await service.findExpiryReport({
        nearExpiryDays: 45,
        showExpired: true,
        showNearExpiry: true,
      });

      expect(result.nearExpiryDays).toBe(45);
    });

    it('should default nearExpiryDays to 30', async () => {
      prisma.batch.findMany.mockResolvedValue([]);
      prisma.batch.count.mockResolvedValue(0);

      const result = await service.findExpiryReport({});

      expect(result.nearExpiryDays).toBe(30);
    });

    it('should filter by productId', async () => {
      prisma.batch.findMany.mockResolvedValue([]);
      prisma.batch.count.mockResolvedValue(0);

      await service.findExpiryReport({ productId, showExpired: true, showNearExpiry: true });

      expect(prisma.batch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ productId }),
        }),
      );
    });

    it('should include product and inventoryBalances relations', async () => {
      prisma.batch.findMany.mockResolvedValue([]);
      prisma.batch.count.mockResolvedValue(0);

      await service.findExpiryReport({ showExpired: true, showNearExpiry: true });

      expect(prisma.batch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            product: expect.any(Object),
            inventoryBalances: expect.objectContaining({
              select: expect.objectContaining({
                location: expect.any(Object),
              }),
            }),
          }),
        }),
      );
    });

    it('should order by expiryDate ascending', async () => {
      prisma.batch.findMany.mockResolvedValue([]);
      prisma.batch.count.mockResolvedValue(0);

      await service.findExpiryReport({ showExpired: true, showNearExpiry: true });

      expect(prisma.batch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { expiryDate: 'asc' } }),
      );
    });

    it('should compute remainingDays, isExpired, isNearExpiry, totalStock for each item', async () => {
      const batchItem = mockBatchWithProduct({ expiryDate: futureDate });
      prisma.batch.findMany.mockResolvedValue([batchItem]);
      prisma.batch.count.mockResolvedValue(1);

      const result = await service.findExpiryReport({
        showExpired: true,
        showNearExpiry: true,
      });

      expect(result.items[0]).toMatchObject({
        id: batchId,
        remainingDays: 42,
        isExpired: false,
        isNearExpiry: false,
        totalStock: 100,
      });
    });

    it('should mark expired batches correctly', async () => {
      const batchItem = mockBatchWithProduct({ expiryDate: expiredDate, status: 'EXPIRED' });
      prisma.batch.findMany.mockResolvedValue([batchItem]);
      prisma.batch.count.mockResolvedValue(1);

      const result = await service.findExpiryReport({
        showExpired: true,
        showNearExpiry: true,
      });

      expect(result.items[0]).toMatchObject({
        remainingDays: -33,
        isExpired: true,
        isNearExpiry: false,
      });
    });

    it('should mark near-expiry batches correctly', async () => {
      const batchItem = mockBatchWithProduct({ expiryDate: nearExpiryDate, status: 'NEAR_EXPIRY' });
      prisma.batch.findMany.mockResolvedValue([batchItem]);
      prisma.batch.count.mockResolvedValue(1);

      const result = await service.findExpiryReport({
        showExpired: true,
        showNearExpiry: true,
      });

      expect(result.items[0]).toMatchObject({
        remainingDays: 16,
        isExpired: false,
        isNearExpiry: true,
      });
    });

    it('should handle batch without expiry date', async () => {
      const batchItem = mockBatchWithProduct({ expiryDate: null });
      prisma.batch.findMany.mockResolvedValue([batchItem]);
      prisma.batch.count.mockResolvedValue(1);

      const result = await service.findExpiryReport({
        showExpired: true,
        showNearExpiry: true,
      });

      expect(result.items[0]).toMatchObject({
        remainingDays: null,
        isExpired: false,
        isNearExpiry: false,
        totalStock: 100,
      });
    });

    it('should filter to only expired when showNearExpiry is false', async () => {
      prisma.batch.findMany.mockResolvedValue([]);
      prisma.batch.count.mockResolvedValue(0);

      await service.findExpiryReport({ showExpired: true, showNearExpiry: false });

      expect(prisma.batch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            expiryDate: { lt: now },
          }),
        }),
      );
    });

    it('should filter to only near-expiry when showExpired is false', async () => {
      prisma.batch.findMany.mockResolvedValue([]);
      prisma.batch.count.mockResolvedValue(0);

      await service.findExpiryReport({ showExpired: false, showNearExpiry: true });

      const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      expect(prisma.batch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            expiryDate: { gte: now, lte: future },
          }),
        }),
      );
    });

    it('should return no batches when both showExpired and showNearExpiry are false', async () => {
      prisma.batch.findMany.mockResolvedValue([]);
      prisma.batch.count.mockResolvedValue(0);

      const result = await service.findExpiryReport({
        showExpired: false,
        showNearExpiry: false,
      });

      // Should still work — no expiry conditions added
      expect(result.items).toHaveLength(0);
    });
  });

  // ===========================================================================
  // findValuation
  // ===========================================================================
  describe('findValuation', () => {
    const priceListId = 'pl-1';

    const balanceWithProduct = (overrides: Record<string, unknown> = {}) => ({
      id: 'ib-1',
      productId,
      locationId,
      batchId,
      quantity: 100,
      product: mockProduct,
      location: mockLocation,
      batch: mockBatch,
      ...overrides,
    });

    it('should return valuation items with unit price and total value', async () => {
      prisma.priceList.findFirst.mockResolvedValue({ id: priceListId });
      prisma.inventoryBalance.findMany.mockResolvedValue([balanceWithProduct()]);
      prisma.productPrice.findMany.mockResolvedValue([
        { productId, unitPrice: 25.50, effectiveDate: new Date('2026-01-01'), endDate: null },
      ]);

      const result = await service.findValuation({});

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({
        productId,
        skuCode: 'SKU-001',
        quantity: 100,
        unitPrice: 25.50,
        totalValue: 2550,
      });
    });

    it('should use the specified priceListId', async () => {
      prisma.inventoryBalance.findMany.mockResolvedValue([balanceWithProduct()]);
      prisma.productPrice.findMany.mockResolvedValue([
        { productId, unitPrice: 10, effectiveDate: new Date('2026-01-01'), endDate: null },
      ]);

      await service.findValuation({ priceListId: 'custom-pl' });

      expect(prisma.productPrice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ priceListId: 'custom-pl' }),
        }),
      );
    });

    it('should find default ACTIVE price list when not specified', async () => {
      prisma.priceList.findFirst.mockResolvedValue({ id: priceListId });
      prisma.inventoryBalance.findMany.mockResolvedValue([balanceWithProduct()]);
      prisma.productPrice.findMany.mockResolvedValue([
        { productId, unitPrice: 25.50, effectiveDate: new Date('2026-01-01'), endDate: null },
      ]);

      await service.findValuation({});

      expect(prisma.priceList.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'ACTIVE' } }),
      );
    });

    it('should return empty items when no price list is found', async () => {
      prisma.priceList.findFirst.mockResolvedValue(null);
      prisma.inventoryBalance.findMany.mockResolvedValue([balanceWithProduct()]);

      const result = await service.findValuation({});

      expect(result.items).toHaveLength(0);
      expect(result.totalItems).toBe(0);
      expect(result.grandTotal).toBe(0);
    });

    it('should filter by warehouseId', async () => {
      prisma.priceList.findFirst.mockResolvedValue({ id: priceListId });
      prisma.inventoryBalance.findMany.mockResolvedValue([]);
      prisma.productPrice.findMany.mockResolvedValue([]);

      await service.findValuation({ warehouseId });

      expect(prisma.inventoryBalance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            location: { warehouseId },
            quantity: { gt: 0 },
          }),
        }),
      );
    });

    it('should filter by categoryId', async () => {
      prisma.priceList.findFirst.mockResolvedValue({ id: priceListId });
      prisma.inventoryBalance.findMany.mockResolvedValue([
        balanceWithProduct(),
        balanceWithProduct({
          id: 'ib-2',
          productId: productId2,
          product: mockProduct2,
        }),
      ]);
      prisma.productPrice.findMany.mockResolvedValue([
        { productId, unitPrice: 10, effectiveDate: new Date('2026-01-01'), endDate: null },
        { productId: productId2, unitPrice: 20, effectiveDate: new Date('2026-01-01'), endDate: null },
      ]);

      const result = await service.findValuation({ categoryId }) as { items: Array<Record<string, unknown>> };

      expect(result.items).toHaveLength(1);
      expect(result.items[0].productId).toBe(productId);
    });

    it('should group by warehouse', async () => {
      prisma.priceList.findFirst.mockResolvedValue({ id: priceListId });
      prisma.inventoryBalance.findMany.mockResolvedValue([
        balanceWithProduct({ quantity: 50 }),
        balanceWithProduct({
          id: 'ib-2',
          locationId: locationId2,
          location: mockLocation2,
          quantity: 30,
        }),
      ]);
      prisma.productPrice.findMany.mockResolvedValue([
        { productId, unitPrice: 10, effectiveDate: new Date('2026-01-01'), endDate: null },
      ]);

      const result = await service.findValuation({ groupBy: 'warehouse' });

      expect(result.groupBy).toBe('warehouse');
      expect(result.items).toHaveLength(1); // same warehouse
      expect(result.items[0]).toMatchObject({
        warehouseId,
        totalQuantity: 80,
        totalValue: 800,
      });
    });

    it('should group by category', async () => {
      prisma.priceList.findFirst.mockResolvedValue({ id: priceListId });
      prisma.inventoryBalance.findMany.mockResolvedValue([
        balanceWithProduct({ product: mockProduct, quantity: 100 }),
        balanceWithProduct({
          id: 'ib-2',
          productId: productId2,
          product: mockProduct2,
          quantity: 50,
        }),
      ]);
      prisma.productPrice.findMany.mockResolvedValue([
        { productId, unitPrice: 10, effectiveDate: new Date('2026-01-01'), endDate: null },
        { productId: productId2, unitPrice: 20, effectiveDate: new Date('2026-01-01'), endDate: null },
      ]);

      const result = await service.findValuation({ groupBy: 'category' });

      expect(result.groupBy).toBe('category');
      expect(result.items).toHaveLength(2);
      const catItem = result.items.find((i: Record<string, unknown>) => i.categoryId === categoryId);
      expect(catItem).toBeDefined();
      expect(catItem?.totalValue).toBe(1000);
    });
  });

  // ===========================================================================
  // findSummary
  // ===========================================================================
  describe('findSummary', () => {
    it('should return summary grouped by product by default', async () => {
      prisma.inventoryBalance.groupBy.mockResolvedValue([
        { productId, _sum: { quantity: 150 }, _count: { locationId: 2 } },
      ]);
      prisma.product.findMany.mockResolvedValue([mockProduct]);

      const result = await service.findSummary({});

      expect(result.groupBy).toBe('product');
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({
        productId,
        skuCode: 'SKU-001',
        productName: '测试商品A',
        totalQuantity: 150,
        locationCount: 2,
      });
    });

    it('should return summary grouped by warehouse', async () => {
      prisma.inventoryBalance.groupBy.mockResolvedValue([
        { locationId, _sum: { quantity: 200 }, _count: { productId: 3 } },
      ]);
      prisma.location.findMany.mockResolvedValue([mockLocation]);

      const result = await service.findSummary({ groupBy: 'warehouse' });

      expect(result.groupBy).toBe('warehouse');
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({
        warehouseId,
        warehouseCode: 'WH-01',
        warehouseName: '主仓库',
        totalQuantity: 200,
        productCount: 3,
      });
    });

    it('should filter by warehouseId when groupBy is product', async () => {
      prisma.inventoryBalance.groupBy.mockResolvedValue([]);
      prisma.product.findMany.mockResolvedValue([]);

      await service.findSummary({ warehouseId, groupBy: 'product' });

      expect(prisma.inventoryBalance.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            location: { warehouseId },
            quantity: { gt: 0 },
          }),
        }),
      );
    });

    it('should filter by productId when groupBy is product', async () => {
      prisma.inventoryBalance.groupBy.mockResolvedValue([]);
      prisma.product.findMany.mockResolvedValue([]);

      await service.findSummary({ productId, groupBy: 'product' });

      expect(prisma.inventoryBalance.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ productId, quantity: { gt: 0 } }),
        }),
      );
    });

    it('should handle empty results', async () => {
      prisma.inventoryBalance.groupBy.mockResolvedValue([]);
      prisma.product.findMany.mockResolvedValue([]);

      const result = await service.findSummary({ groupBy: 'product' });

      expect(result.items).toHaveLength(0);
    });

    it('should only consider balances with quantity > 0', async () => {
      prisma.inventoryBalance.groupBy.mockResolvedValue([]);
      prisma.product.findMany.mockResolvedValue([]);

      await service.findSummary({ groupBy: 'product' });

      expect(prisma.inventoryBalance.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ quantity: { gt: 0 } }),
        }),
      );
    });
  });
});
