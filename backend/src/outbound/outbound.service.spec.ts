import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { OutboundService } from './outbound.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BatchesService } from '../batches/batches.service';

// ---------------------------------------------------------------------------
// Types for mocked Prisma
// ---------------------------------------------------------------------------
type MockPrisma = {
  $transaction: ReturnType<typeof vi.fn>;
  shippingOrder: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  shippingOrderItem: Record<string, ReturnType<typeof vi.fn>>;
  warehouse: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  location: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  product: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  batch: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  stockMovement: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  inventoryBalance: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
  auditLog: {
    create: ReturnType<typeof vi.fn>;
  };
};

type MockTx = {
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
    update: ReturnType<typeof vi.fn>;
  };
  auditLog: {
    create: ReturnType<typeof vi.fn>;
  };
  batch: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
};

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------
const now = new Date('2026-07-04T12:00:00Z');
const productId = 'prod-1';
const productId2 = 'prod-2';
const warehouseId = 'wh-1';
const locationId = 'loc-1';
const orderId = 'so-1';
const referenceNo = 'SO-20260704-TEST';

const batchId1 = 'batch-1'; // expires in 2026-08-01 (28 days)
const batchId2 = 'batch-2'; // expires in 2026-09-01 (59 days)
const batchId3 = 'batch-3'; // no expiry

const mockWarehouse = {
  id: warehouseId,
  code: 'WH-01',
  name: '主仓库',
  type: 'PHYSICAL',
  address: null,
  status: 'ACTIVE',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockLocation = {
  id: locationId,
  warehouseId,
  area: 'A',
  aisle: '01',
  rack: 'A',
  level: '1',
  position: '01',
  barcode: null,
  status: 'ACTIVE',
  maxCapacity: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockProduct = {
  id: productId,
  skuCode: 'SKU-001',
  name: '测试商品A',
  description: null,
  categoryId: null,
  brand: null,
  unitOfMeasure: 'PCS',
  barcode: null,
  specifications: null,
  status: 'ACTIVE',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockProduct2 = {
  id: productId2,
  skuCode: 'SKU-002',
  name: '测试商品B',
  description: null,
  categoryId: null,
  brand: null,
  unitOfMeasure: 'PCS',
  barcode: null,
  specifications: null,
  status: 'ACTIVE',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockBatches: Record<string, any> = {
  [batchId1]: {
    id: batchId1,
    batchNo: 'BATCH-001',
    productId,
    productionDate: new Date('2026-06-01'),
    expiryDate: new Date('2026-08-01'),
    status: 'ACTIVE',
    createdAt: new Date('2026-07-01'),
    updatedAt: new Date('2026-07-01'),
  },
  [batchId2]: {
    id: batchId2,
    batchNo: 'BATCH-002',
    productId,
    productionDate: new Date('2026-06-15'),
    expiryDate: new Date('2026-09-01'),
    status: 'ACTIVE',
    createdAt: new Date('2026-07-01'),
    updatedAt: new Date('2026-07-01'),
  },
  [batchId3]: {
    id: batchId3,
    batchNo: 'BATCH-003',
    productId,
    productionDate: new Date('2026-06-01'),
    expiryDate: null,
    status: 'ACTIVE',
    createdAt: new Date('2026-07-01'),
    updatedAt: new Date('2026-07-01'),
  },
};

const expiredBatch = {
  id: 'batch-expired',
  batchNo: 'BATCH-EXPIRED',
  productId,
  productionDate: new Date('2025-01-01'),
  expiryDate: new Date('2026-01-01'),
  status: 'EXPIRED',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

function buildBalance(
  batchId: string,
  qty: number,
  overrides: Record<string, unknown> = {},
) {
  const batch = mockBatches[batchId] || expiredBatch;
  return {
    id: `ib-${batchId}`,
    productId: batch.productId,
    locationId,
    batchId,
    quantity: qty,
    batch,
    createdAt: new Date('2026-07-01'),
    updatedAt: new Date('2026-07-01'),
    ...overrides,
  };
}

const mockOrderItem = (overrides: Record<string, unknown> = {}) => ({
  id: 'item-1',
  shippingOrderId: orderId,
  productId,
  quantity: 10,
  product: mockProduct,
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

const mockOrder = (overrides: Record<string, unknown> = {}) => ({
  id: orderId,
  referenceNo,
  status: 'DRAFT',
  warehouseId,
  locationId,
  operator: 'admin',
  notes: null,
  shipmentDate: null,
  createdAt: now,
  updatedAt: now,
  items: [mockOrderItem()],
  ...overrides,
});

function createTxMock(): MockTx {
  return {
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
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    batch: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('OutboundService', () => {
  let service: OutboundService;
  let prisma: MockPrisma;
  let auditService: { log: ReturnType<typeof vi.fn> };
  let batchesService: {
    validateBatchNotExpired: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);

    prisma = {
      $transaction: vi.fn(),
      shippingOrder: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      shippingOrderItem: {},
      warehouse: {
        findUnique: vi.fn(),
      },
      location: {
        findUnique: vi.fn(),
      },
      product: {
        findUnique: vi.fn(),
      },
      batch: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
      stockMovement: {
        create: vi.fn(),
        findMany: vi.fn(),
      },
      inventoryBalance: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        upsert: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
    };

    auditService = {
      log: vi.fn(),
    };

    batchesService = {
      validateBatchNotExpired: vi.fn(),
    };

    service = new OutboundService(
      prisma as unknown as PrismaService,
      auditService as unknown as AuditService,
      batchesService as unknown as BatchesService,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // =========================================================================
  // create
  // =========================================================================
  describe('create', () => {
    const createDto = {
      referenceNo,
      warehouseId,
      locationId,
      notes: 'Test shipment',
      shipmentDate: '2026-07-05T00:00:00Z',
      items: [{ productId, quantity: 10 }],
    };

    it('should create a DRAFT shipping order successfully', async () => {
      prisma.warehouse.findUnique.mockResolvedValue(mockWarehouse);
      prisma.location.findUnique.mockResolvedValue(mockLocation);
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      prisma.shippingOrder.findUnique.mockResolvedValue(null);
      prisma.shippingOrder.create.mockResolvedValue(mockOrder());

      const result = await service.create(createDto, 'admin');

      expect(result).toMatchObject({ referenceNo, status: 'DRAFT' });
      expect(prisma.shippingOrder.create).toHaveBeenCalledOnce();
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'ShippingOrder',
          action: 'CREATE',
          operator: 'admin',
        }),
      );
    });

    it('should throw NotFoundException if warehouse does not exist', async () => {
      prisma.warehouse.findUnique.mockResolvedValue(null);
      await expect(service.create(createDto, 'admin')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if location does not exist', async () => {
      prisma.warehouse.findUnique.mockResolvedValue(mockWarehouse);
      prisma.location.findUnique.mockResolvedValue(null);
      await expect(service.create(createDto, 'admin')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if location is not ACTIVE', async () => {
      prisma.warehouse.findUnique.mockResolvedValue(mockWarehouse);
      prisma.location.findUnique.mockResolvedValue({ ...mockLocation, status: 'INACTIVE' });
      await expect(service.create(createDto, 'admin')).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if product does not exist', async () => {
      prisma.warehouse.findUnique.mockResolvedValue(mockWarehouse);
      prisma.location.findUnique.mockResolvedValue(mockLocation);
      prisma.product.findUnique.mockResolvedValue(null);
      await expect(service.create(createDto, 'admin')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if product is not ACTIVE', async () => {
      prisma.warehouse.findUnique.mockResolvedValue(mockWarehouse);
      prisma.location.findUnique.mockResolvedValue(mockLocation);
      prisma.product.findUnique.mockResolvedValue({ ...mockProduct, status: 'DISCONTINUED' });
      await expect(service.create(createDto, 'admin')).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException if referenceNo already exists', async () => {
      prisma.warehouse.findUnique.mockResolvedValue(mockWarehouse);
      prisma.location.findUnique.mockResolvedValue(mockLocation);
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      prisma.shippingOrder.findUnique.mockResolvedValue(mockOrder());
      await expect(service.create(createDto, 'admin')).rejects.toThrow(ConflictException);
    });

    it('should generate referenceNo when not provided', async () => {
      const { referenceNo: _, ...dtoWithoutRef } = createDto;
      prisma.warehouse.findUnique.mockResolvedValue(mockWarehouse);
      prisma.location.findUnique.mockResolvedValue(mockLocation);
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      prisma.shippingOrder.create.mockResolvedValue(mockOrder({ referenceNo: 'SO-20260704-ABCD' }));
      const result = await service.create(dtoWithoutRef as any, 'admin');
      expect(result.referenceNo).toMatch(/^SO-/);
    });
  });

  // =========================================================================
  // findAll
  // =========================================================================
  describe('findAll', () => {
    it('should return paginated orders', async () => {
      prisma.shippingOrder.findMany.mockResolvedValue([mockOrder()]);
      prisma.shippingOrder.count.mockResolvedValue(1);
      const result = await service.findAll({ page: 1, limit: 20 });
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by status', async () => {
      prisma.shippingOrder.findMany.mockResolvedValue([]);
      prisma.shippingOrder.count.mockResolvedValue(0);
      await service.findAll({ status: 'DRAFT' });
      expect(prisma.shippingOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: 'DRAFT' }) }),
      );
    });
  });

  // =========================================================================
  // findOne
  // =========================================================================
  describe('findOne', () => {
    it('should return an order with items', async () => {
      prisma.shippingOrder.findUnique.mockResolvedValue(mockOrder());
      const result = await service.findOne(orderId);
      expect(result).toMatchObject({ id: orderId, referenceNo });
    });

    it('should throw NotFoundException if not found', async () => {
      prisma.shippingOrder.findUnique.mockResolvedValue(null);
      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // getFefoSuggestions
  // =========================================================================
  describe('getFefoSuggestions', () => {
    it('should return FEFO suggestions sorted by expiry ASC', async () => {
      const order = mockOrder({ items: [mockOrderItem({ quantity: 15 })] });
      prisma.shippingOrder.findUnique.mockResolvedValue(order);
      prisma.inventoryBalance.findMany.mockResolvedValue([
        buildBalance(batchId1, 10),
        buildBalance(batchId2, 10),
      ]);

      const result = await service.getFefoSuggestions(orderId);

      expect(result).toHaveLength(1);
      expect(result[0].requestedQty).toBe(15);
      expect(result[0].allocatedQty).toBe(15);
      expect(result[0].allocations[0].batchId).toBe(batchId1);
      expect(result[0].allocations[0].quantity).toBe(10);
      expect(result[0].allocations[1].batchId).toBe(batchId2);
      expect(result[0].allocations[1].quantity).toBe(5);
    });

    it('should skip expired batches', async () => {
      const order = mockOrder({ items: [mockOrderItem({ quantity: 5 })] });
      prisma.shippingOrder.findUnique.mockResolvedValue(order);
      prisma.inventoryBalance.findMany.mockResolvedValue([
        buildBalance('batch-expired', 10, { batch: expiredBatch }),
        buildBalance(batchId1, 10),
      ]);

      const result = await service.getFefoSuggestions(orderId);

      expect(result[0].allocations).toHaveLength(1);
      expect(result[0].allocations[0].batchId).toBe(batchId1);
    });

    it('should sort null expiry last', async () => {
      const order = mockOrder({ items: [mockOrderItem({ quantity: 25 })] });
      prisma.shippingOrder.findUnique.mockResolvedValue(order);
      prisma.inventoryBalance.findMany.mockResolvedValue([
        buildBalance(batchId1, 10),
        buildBalance(batchId3, 20),
        buildBalance(batchId2, 10),
      ]);

      const result = await service.getFefoSuggestions(orderId);

      expect(result[0].allocations[0].batchId).toBe(batchId1);
      expect(result[0].allocations[1].batchId).toBe(batchId2);
      expect(result[0].allocations[2].batchId).toBe(batchId3);
    });

    it('should partially allocate when stock is insufficient', async () => {
      const order = mockOrder({ items: [mockOrderItem({ quantity: 100 })] });
      prisma.shippingOrder.findUnique.mockResolvedValue(order);
      prisma.inventoryBalance.findMany.mockResolvedValue([buildBalance(batchId1, 10)]);

      const result = await service.getFefoSuggestions(orderId);

      expect(result[0].requestedQty).toBe(100);
      expect(result[0].allocatedQty).toBe(10);
    });

    it('should throw NotFoundException if order does not exist', async () => {
      prisma.shippingOrder.findUnique.mockResolvedValue(null);
      await expect(service.getFefoSuggestions('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // update
  // =========================================================================
  describe('update', () => {
    it('should update a DRAFT order', async () => {
      prisma.shippingOrder.findUnique.mockResolvedValue(mockOrder());
      prisma.shippingOrder.update.mockResolvedValue(mockOrder({ notes: 'Updated notes' }));
      const result = await service.update(orderId, { notes: 'Updated notes' }, 'admin');
      expect(result.notes).toBe('Updated notes');
      expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'UPDATE' }));
    });

    it('should throw BadRequestException if not DRAFT', async () => {
      prisma.shippingOrder.findUnique.mockResolvedValue(mockOrder({ status: 'SUBMITTED' }));
      await expect(service.update(orderId, { notes: 'test' }, 'admin')).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if order not found', async () => {
      prisma.shippingOrder.findUnique.mockResolvedValue(null);
      await expect(service.update('nonexistent', { notes: 'test' }, 'admin')).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // submit (FEFO stock deduction)
  // =========================================================================
  describe('submit', () => {
    it('should submit a DRAFT order and deduct stock via FEFO', async () => {
      const order = mockOrder({ items: [mockOrderItem({ quantity: 15 })] });
      prisma.shippingOrder.findUnique.mockResolvedValue(order);

      const tx = createTxMock();
      tx.inventoryBalance.findMany.mockResolvedValue([
        buildBalance(batchId1, 10),
        buildBalance(batchId2, 10),
      ]);
      tx.inventoryBalance.findUnique
        .mockResolvedValueOnce({ id: `ib-${batchId1}`, quantity: 10 })
        .mockResolvedValueOnce({ id: `ib-${batchId2}`, quantity: 10 });
      tx.inventoryBalance.update.mockResolvedValue({});
      tx.stockMovement.create.mockResolvedValue({ id: 'sm-1' });
      tx.shippingOrder.update.mockResolvedValue(mockOrder({ status: 'SUBMITTED' }));

      prisma.$transaction.mockImplementation((cb: (tx: MockTx) => Promise<unknown>) => cb(tx));

      const result = await service.submit(orderId, 'admin');

      expect(result.status).toBe('SUBMITTED');
      expect(tx.inventoryBalance.update).toHaveBeenCalledTimes(2);
      expect(tx.stockMovement.create).toHaveBeenCalledTimes(2);

      // FEFO: batch-1 gets 10 first, then batch-2 gets 5
      expect(tx.inventoryBalance.update).toHaveBeenNthCalledWith(
        1, expect.objectContaining({
          where: { id: `ib-${batchId1}` },
          data: { quantity: { decrement: 10 } },
        }),
      );
      expect(tx.inventoryBalance.update).toHaveBeenNthCalledWith(
        2, expect.objectContaining({
          where: { id: `ib-${batchId2}` },
          data: { quantity: { decrement: 5 } },
        }),
      );
      expect(tx.auditLog.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException when stock is insufficient', async () => {
      const order = mockOrder({ items: [mockOrderItem({ quantity: 100 })] });
      prisma.shippingOrder.findUnique.mockResolvedValue(order);

      const tx = createTxMock();
      tx.inventoryBalance.findMany.mockResolvedValue([buildBalance(batchId1, 10)]);

      prisma.$transaction.mockImplementation((cb: (tx: MockTx) => Promise<unknown>) => cb(tx));

      await expect(service.submit(orderId, 'admin')).rejects.toThrow(BadRequestException);
    });

    it('should skip expired batches during FEFO allocation', async () => {
      const order = mockOrder({ items: [mockOrderItem({ quantity: 5 })] });
      prisma.shippingOrder.findUnique.mockResolvedValue(order);

      const tx = createTxMock();
      tx.inventoryBalance.findMany.mockResolvedValue([
        buildBalance('batch-expired', 10, { batch: expiredBatch }),
        buildBalance(batchId1, 10),
      ]);
      tx.inventoryBalance.findUnique.mockResolvedValue({ id: `ib-${batchId1}`, quantity: 10 });
      tx.inventoryBalance.update.mockResolvedValue({});
      tx.stockMovement.create.mockResolvedValue({ id: 'sm-1' });
      tx.shippingOrder.update.mockResolvedValue(mockOrder({ status: 'SUBMITTED' }));

      prisma.$transaction.mockImplementation((cb: (tx: MockTx) => Promise<unknown>) => cb(tx));

      const result = await service.submit(orderId, 'admin');
      expect(result.status).toBe('SUBMITTED');
      expect(tx.inventoryBalance.update).toHaveBeenCalledTimes(1);
      expect(tx.stockMovement.create).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple items in a single order', async () => {
      const order = mockOrder({
        items: [
          mockOrderItem({ id: 'item-1', quantity: 10 }),
          mockOrderItem({
            id: 'item-2', productId: productId2, quantity: 20, product: mockProduct2,
          }),
        ],
      });
      prisma.shippingOrder.findUnique.mockResolvedValue(order);

      const tx = createTxMock();
      tx.inventoryBalance.findMany
        .mockResolvedValueOnce([buildBalance(batchId1, 10)])
        .mockResolvedValueOnce([{
          ...buildBalance(batchId2, 20),
          productId: productId2,
          batch: { ...mockBatches[batchId2], productId: productId2 },
        }]);
      tx.inventoryBalance.findUnique
        .mockResolvedValueOnce({ id: `ib-${batchId1}`, quantity: 10 })
        .mockResolvedValueOnce({ id: `ib-${batchId2}`, quantity: 20 });
      tx.inventoryBalance.update.mockResolvedValue({});
      tx.stockMovement.create.mockResolvedValue({ id: 'sm-1' });
      tx.shippingOrder.update.mockResolvedValue(mockOrder({ status: 'SUBMITTED' }));

      prisma.$transaction.mockImplementation((cb: (tx: MockTx) => Promise<unknown>) => cb(tx));

      const result = await service.submit(orderId, 'admin');
      expect(result.status).toBe('SUBMITTED');
      expect(tx.inventoryBalance.update).toHaveBeenCalledTimes(2);
      expect(tx.stockMovement.create).toHaveBeenCalledTimes(2);
    });

    it('should use correct location for stock deduction', async () => {
      const customLocationId = 'loc-2';
      const order = mockOrder({ locationId: customLocationId, items: [mockOrderItem({ quantity: 5 })] });
      prisma.shippingOrder.findUnique.mockResolvedValue(order);

      const tx = createTxMock();
      tx.inventoryBalance.findMany.mockResolvedValue([buildBalance(batchId1, 10)]);
      tx.inventoryBalance.findUnique.mockResolvedValue({ id: `ib-${batchId1}`, quantity: 10 });
      tx.inventoryBalance.update.mockResolvedValue({});
      tx.stockMovement.create.mockResolvedValue({ id: 'sm-1' });
      tx.shippingOrder.update.mockResolvedValue(mockOrder({ status: 'SUBMITTED', locationId: customLocationId }));

      prisma.$transaction.mockImplementation((cb: (tx: MockTx) => Promise<unknown>) => cb(tx));

      await service.submit(orderId, 'admin');

      expect(tx.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ fromLocationId: customLocationId, type: 'OUTBOUND' }),
        }),
      );
    });

    it('should throw NotFoundException if order does not exist', async () => {
      prisma.shippingOrder.findUnique.mockResolvedValue(null);
      await expect(service.submit('nonexistent', 'admin')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if order is not DRAFT', async () => {
      prisma.shippingOrder.findUnique.mockResolvedValue(mockOrder({ status: 'SUBMITTED' }));
      await expect(service.submit(orderId, 'admin')).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // complete
  // =========================================================================
  describe('complete', () => {
    it('should complete a SUBMITTED order', async () => {
      prisma.shippingOrder.findUnique.mockResolvedValue(mockOrder({ status: 'SUBMITTED' }));
      prisma.shippingOrder.update.mockResolvedValue(mockOrder({ status: 'COMPLETED' }));
      const result = await service.complete(orderId, 'admin');
      expect(result.status).toBe('COMPLETED');
      expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'COMPLETE' }));
    });

    it('should throw BadRequestException if not SUBMITTED', async () => {
      prisma.shippingOrder.findUnique.mockResolvedValue(mockOrder({ status: 'DRAFT' }));
      await expect(service.complete(orderId, 'admin')).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if order not found', async () => {
      prisma.shippingOrder.findUnique.mockResolvedValue(null);
      await expect(service.complete('nonexistent', 'admin')).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // cancel
  // =========================================================================
  describe('cancel', () => {
    it('should cancel a DRAFT order without stock impact', async () => {
      prisma.shippingOrder.findUnique.mockResolvedValue(mockOrder());
      prisma.shippingOrder.update.mockResolvedValue(mockOrder({ status: 'CANCELLED' }));
      const result = await service.cancel(orderId, 'admin');
      expect(result.status).toBe('CANCELLED');
      expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'CANCEL' }));
    });

    it('should cancel a SUBMITTED order with stock reversal', async () => {
      prisma.shippingOrder.findUnique.mockResolvedValue(mockOrder({ status: 'SUBMITTED' }));

      const tx = createTxMock();
      tx.stockMovement.findMany.mockResolvedValue([{
        id: 'sm-1', type: 'OUTBOUND', productId, batchId: batchId1,
        fromLocationId: locationId, toLocationId: null, quantity: -10, referenceNo,
      }]);
      tx.stockMovement.create.mockResolvedValue({ id: 'sm-reverse' });
      tx.inventoryBalance.findUnique.mockResolvedValue({ id: `ib-${batchId1}`, quantity: 0 });
      tx.inventoryBalance.update.mockResolvedValue({ id: `ib-${batchId1}`, quantity: 10 });
      tx.shippingOrder.update.mockResolvedValue(mockOrder({ status: 'CANCELLED' }));

      prisma.$transaction.mockImplementation((cb: (tx: MockTx) => Promise<unknown>) => cb(tx));

      const result = await service.cancel(orderId, 'admin');
      expect(result.status).toBe('CANCELLED');
      expect(tx.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'INBOUND', quantity: 10 }),
        }),
      );
      expect(tx.inventoryBalance.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { quantity: { increment: 10 } } }),
      );
    });

    it('should cancel a COMPLETED order with stock reversal', async () => {
      prisma.shippingOrder.findUnique.mockResolvedValue(mockOrder({ status: 'COMPLETED' }));

      const tx = createTxMock();
      tx.stockMovement.findMany.mockResolvedValue([{
        id: 'sm-1', type: 'OUTBOUND', productId, batchId: batchId1,
        fromLocationId: locationId, toLocationId: null, quantity: -5, referenceNo,
      }]);
      tx.stockMovement.create.mockResolvedValue({ id: 'sm-reverse' });
      tx.inventoryBalance.findUnique.mockResolvedValue({ id: `ib-${batchId1}`, quantity: 5 });
      tx.inventoryBalance.update.mockResolvedValue({ id: `ib-${batchId1}`, quantity: 10 });
      tx.shippingOrder.update.mockResolvedValue(mockOrder({ status: 'CANCELLED' }));

      prisma.$transaction.mockImplementation((cb: (tx: MockTx) => Promise<unknown>) => cb(tx));

      const result = await service.cancel(orderId, 'admin');
      expect(result.status).toBe('CANCELLED');
      expect(tx.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ quantity: 5 }) }),
      );
    });

    it('should throw BadRequestException if already CANCELLED', async () => {
      prisma.shippingOrder.findUnique.mockResolvedValue(mockOrder({ status: 'CANCELLED' }));
      await expect(service.cancel(orderId, 'admin')).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if order not found', async () => {
      prisma.shippingOrder.findUnique.mockResolvedValue(null);
      await expect(service.cancel('nonexistent', 'admin')).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // remove (delete)
  // =========================================================================
  describe('remove', () => {
    it('should delete a DRAFT order', async () => {
      prisma.shippingOrder.findUnique.mockResolvedValue(mockOrder());
      prisma.shippingOrder.delete.mockResolvedValue(mockOrder());
      await service.remove(orderId, 'admin');
      expect(prisma.shippingOrder.delete).toHaveBeenCalledWith({ where: { id: orderId } });
      expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'DELETE' }));
    });

    it('should throw BadRequestException if not DRAFT', async () => {
      prisma.shippingOrder.findUnique.mockResolvedValue(mockOrder({ status: 'SUBMITTED' }));
      await expect(service.remove(orderId, 'admin')).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if order not found', async () => {
      prisma.shippingOrder.findUnique.mockResolvedValue(null);
      await expect(service.remove('nonexistent', 'admin')).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // FEFO sorting correctness
  // =========================================================================
  describe('FEFO sorting correctness', () => {
    it('should return batches sorted by expiry ASC', async () => {
      const order = mockOrder({ items: [mockOrderItem({ quantity: 30 })] });
      prisma.shippingOrder.findUnique.mockResolvedValue(order);

      const batchLate = { ...mockBatches[batchId2] };
      const batchEarly = { ...mockBatches[batchId1] };
      const batchNoExpiry = { ...mockBatches[batchId3] };

      prisma.inventoryBalance.findMany.mockResolvedValue([
        buildBalance(batchId2, 10, { batch: batchLate }),
        buildBalance(batchId1, 10, { batch: batchEarly }),
        buildBalance(batchId3, 10, { batch: batchNoExpiry }),
      ]);

      const result = await service.getFefoSuggestions(orderId);

      expect(result[0].allocations[0].batchId).toBe(batchId1);
      expect(result[0].allocations[1].batchId).toBe(batchId2);
      expect(result[0].allocations[2].batchId).toBe(batchId3);
    });
  });

  // =========================================================================
  // Concurrent correctness
  // =========================================================================
  describe('concurrent correctness', () => {
    it('should use $transaction to prevent overselling', async () => {
      const order = mockOrder({ items: [mockOrderItem({ quantity: 10 })] });
      prisma.shippingOrder.findUnique.mockResolvedValue(order);

      const tx = createTxMock();
      tx.inventoryBalance.findMany.mockResolvedValue([buildBalance(batchId1, 10)]);
      tx.inventoryBalance.findUnique.mockResolvedValue({ id: `ib-${batchId1}`, quantity: 10 });
      tx.inventoryBalance.update.mockResolvedValue({});
      tx.stockMovement.create.mockResolvedValue({ id: 'sm-1' });
      tx.shippingOrder.update.mockResolvedValue(mockOrder({ status: 'SUBMITTED' }));

      prisma.$transaction.mockImplementation((cb: (tx: MockTx) => Promise<unknown>) => cb(tx));

      const [r1, r2] = await Promise.all([
        service.submit(orderId, 'admin'),
        service.submit(orderId, 'admin'),
      ]);

      expect(r1.status).toBe('SUBMITTED');
      expect(r2.status).toBe('SUBMITTED');
      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    });

    it('should reject overselling when stock is insufficient after concurrent deduction', async () => {
      const order = mockOrder({ items: [mockOrderItem({ quantity: 10 })] });
      const orderId2 = 'so-2';
      const order2 = mockOrder({
        id: orderId2, referenceNo: 'SO-20260704-002',
        items: [mockOrderItem({ quantity: 10 })],
      });

      prisma.shippingOrder.findUnique
        .mockResolvedValueOnce(order)
        .mockResolvedValueOnce(order2);

      const tx1 = createTxMock();
      tx1.inventoryBalance.findMany.mockResolvedValue([buildBalance(batchId1, 10)]);
      tx1.inventoryBalance.findUnique.mockResolvedValue({ id: `ib-${batchId1}`, quantity: 10 });
      tx1.inventoryBalance.update.mockResolvedValue({});
      tx1.stockMovement.create.mockResolvedValue({ id: 'sm-1' });
      tx1.shippingOrder.update.mockResolvedValue(mockOrder({ status: 'SUBMITTED' }));

      const tx2 = createTxMock();
      tx2.inventoryBalance.findMany.mockResolvedValue([buildBalance(batchId1, 0)]);

      prisma.$transaction
        .mockImplementationOnce((cb: (tx: MockTx) => Promise<unknown>) => cb(tx1))
        .mockImplementationOnce((cb: (tx: MockTx) => Promise<unknown>) => cb(tx2));

      const r1 = await service.submit(orderId, 'admin');
      expect(r1.status).toBe('SUBMITTED');

      await expect(service.submit(orderId2, 'admin')).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // Status transition validation
  // =========================================================================
  describe('status transitions', () => {
    it('should enforce DRAFT -> SUBMITTED -> COMPLETED flow', async () => {
      prisma.shippingOrder.findUnique.mockResolvedValue(mockOrder());
      await expect(service.complete(orderId, 'admin')).rejects.toThrow(BadRequestException);
    });

    it('should prevent submitting an already SUBMITTED order', async () => {
      prisma.shippingOrder.findUnique.mockResolvedValue(mockOrder({ status: 'SUBMITTED' }));
      await expect(service.submit(orderId, 'admin')).rejects.toThrow(BadRequestException);
    });

    it('should prevent completing an already COMPLETED order', async () => {
      prisma.shippingOrder.findUnique.mockResolvedValue(mockOrder({ status: 'COMPLETED' }));
      await expect(service.complete(orderId, 'admin')).rejects.toThrow(BadRequestException);
    });
  });
});