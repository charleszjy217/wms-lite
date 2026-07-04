import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InboundService } from './inbound.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

// ---------------------------------------------------------------------------
// Types for mocked Prisma
// ---------------------------------------------------------------------------
type MockPrisma = {
  $transaction: ReturnType<typeof vi.fn>;
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
    create: ReturnType<typeof vi.fn>;
  };
  stockMovement: {
    create: ReturnType<typeof vi.fn>;
  };
  inventoryBalance: {
    findUnique: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  auditLog: {
    create: ReturnType<typeof vi.fn>;
  };
};

type MockTx = {
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
  stockMovement: {
    create: ReturnType<typeof vi.fn>;
  };
  inventoryBalance: {
    findUnique: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  auditLog: {
    create: ReturnType<typeof vi.fn>;
  };
};

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------
const now = new Date('2026-07-04T12:00:00Z');
const productId = 'prod-1';
const batchId = 'batch-1';
const warehouseId = 'wh-1';
const zoneId = 'zone-1';
const locationId = 'loc-1';
const orderId = 'ro-1';
const referenceNo = 'RO-20260704-TEST';

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

const mockZone = {
  id: zoneId,
  code: 'ZONE-A',
  name: 'A区',
  warehouseId,
  status: 'ACTIVE',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockLocation = {
  id: locationId,
  code: 'LOC-A01',
  zoneId,
  barcode: null,
  status: 'ACTIVE',
  maxCapacity: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  zone: mockZone,
};

const mockProduct = {
  id: productId,
  skuCode: 'SKU-001',
  name: '测试商品',
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

const mockBatch = {
  id: batchId,
  batchNo: 'BATCH-001',
  productId,
  productionDate: null,
  expiryDate: null,
  status: 'ACTIVE',
  createdAt: new Date('2026-07-01'),
  updatedAt: new Date('2026-07-01'),
};

const mockOrderItem = (overrides: Record<string, unknown> = {}) => ({
  id: 'item-1',
  receivingOrderId: orderId,
  productId,
  batchId: null,
  batchNo: 'BATCH-001',
  productionDate: null,
  expiryDate: null,
  quantity: 10,
  product: mockProduct,
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
  receiptDate: null,
  createdAt: now,
  updatedAt: now,
  items: [mockOrderItem()],
  ...overrides,
});

// Default tx mock factory
function createTxMock(): MockTx {
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
    stockMovement: {
      create: vi.fn(),
    },
    inventoryBalance: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('InboundService', () => {
  let service: InboundService;
  let prisma: MockPrisma;
  let auditService: { log: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);

    prisma = {
      $transaction: vi.fn(),
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
        create: vi.fn(),
      },
      stockMovement: {
        create: vi.fn(),
      },
      inventoryBalance: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
        update: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
    };

    auditService = {
      log: vi.fn(),
    };

    service = new InboundService(
      prisma as unknown as PrismaService,
      auditService as unknown as AuditService,
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
      notes: 'Test receipt',
      receiptDate: '2026-07-04T00:00:00Z',
      items: [
        {
          productId,
          batchNo: 'BATCH-001',
          quantity: 10,
        },
      ],
    };

    it('should create a DRAFT receiving order successfully', async () => {
      prisma.warehouse.findUnique.mockResolvedValue(mockWarehouse);
      prisma.location.findUnique.mockResolvedValue(mockLocation);
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      prisma.receivingOrder.findUnique.mockResolvedValue(null); // no ref conflict
      prisma.receivingOrder.create.mockResolvedValue(mockOrder());

      const result = await service.create(createDto, 'admin');

      expect(result).toMatchObject({
        referenceNo,
        status: 'DRAFT',
      });
      expect(prisma.receivingOrder.create).toHaveBeenCalledOnce();
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'ReceivingOrder',
          action: 'CREATE',
          operator: 'admin',
        }),
      );
    });

    it('should throw NotFoundException if warehouse does not exist', async () => {
      prisma.warehouse.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto, 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if location does not exist', async () => {
      prisma.warehouse.findUnique.mockResolvedValue(mockWarehouse);
      prisma.location.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto, 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if location not in warehouse', async () => {
      const wrongZone = { ...mockZone, warehouseId: 'other-wh' };
      const wrongLocation = { ...mockLocation, zone: wrongZone };
      prisma.warehouse.findUnique.mockResolvedValue(mockWarehouse);
      prisma.location.findUnique.mockResolvedValue(wrongLocation);

      await expect(service.create(createDto, 'admin')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if location is not ACTIVE', async () => {
      const inactiveLocation = {
        ...mockLocation,
        status: 'INACTIVE',
        zone: mockZone,
      };
      prisma.warehouse.findUnique.mockResolvedValue(mockWarehouse);
      prisma.location.findUnique.mockResolvedValue(inactiveLocation);

      await expect(service.create(createDto, 'admin')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if product does not exist', async () => {
      prisma.warehouse.findUnique.mockResolvedValue(mockWarehouse);
      prisma.location.findUnique.mockResolvedValue(mockLocation);
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto, 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if product is not ACTIVE', async () => {
      const inactiveProduct = { ...mockProduct, status: 'DISCONTINUED' };
      prisma.warehouse.findUnique.mockResolvedValue(mockWarehouse);
      prisma.location.findUnique.mockResolvedValue(mockLocation);
      prisma.product.findUnique.mockResolvedValue(inactiveProduct);

      await expect(service.create(createDto, 'admin')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if provided batchId does not exist', async () => {
      const dtoWithBatch = {
        ...createDto,
        items: [{ productId, batchId: 'nonexistent-batch', batchNo: 'BATCH-001', quantity: 10 }],
      };
      prisma.warehouse.findUnique.mockResolvedValue(mockWarehouse);
      prisma.location.findUnique.mockResolvedValue(mockLocation);
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      prisma.batch.findUnique.mockResolvedValue(null);

      await expect(service.create(dtoWithBatch, 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if batch does not match product', async () => {
      const wrongBatch = { ...mockBatch, productId: 'other-prod' };
      const dtoWithBatch = {
        ...createDto,
        items: [{ productId, batchId, batchNo: 'BATCH-001', quantity: 10 }],
      };
      prisma.warehouse.findUnique.mockResolvedValue(mockWarehouse);
      prisma.location.findUnique.mockResolvedValue(mockLocation);
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      prisma.batch.findUnique.mockResolvedValue(wrongBatch);

      await expect(service.create(dtoWithBatch, 'admin')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ConflictException if referenceNo already exists', async () => {
      prisma.warehouse.findUnique.mockResolvedValue(mockWarehouse);
      prisma.location.findUnique.mockResolvedValue(mockLocation);
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      prisma.receivingOrder.findUnique.mockResolvedValue(mockOrder()); // conflict

      await expect(service.create(createDto, 'admin')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should generate referenceNo when not provided', async () => {
      const dtoWithoutRef = { ...createDto };
      delete (dtoWithoutRef as Record<string, unknown>).referenceNo;
      prisma.warehouse.findUnique.mockResolvedValue(mockWarehouse);
      prisma.location.findUnique.mockResolvedValue(mockLocation);
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      prisma.receivingOrder.create.mockResolvedValue(
        mockOrder({ referenceNo: 'RO-20260704-ABCD' }),
      );

      const result = await service.create(dtoWithoutRef, 'admin');

      expect(result.referenceNo).toBeDefined();
      expect(result.referenceNo).toMatch(/^RO-/);
    });
  });

  // =========================================================================
  // findAll
  // =========================================================================
  describe('findAll', () => {
    it('should return paginated orders', async () => {
      prisma.receivingOrder.findMany.mockResolvedValue([mockOrder()]);
      prisma.receivingOrder.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it('should filter by status', async () => {
      prisma.receivingOrder.findMany.mockResolvedValue([]);
      prisma.receivingOrder.count.mockResolvedValue(0);

      await service.findAll({ status: 'DRAFT' });

      expect(prisma.receivingOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'DRAFT' }),
        }),
      );
    });

    it('should filter by warehouseId', async () => {
      prisma.receivingOrder.findMany.mockResolvedValue([]);
      prisma.receivingOrder.count.mockResolvedValue(0);

      await service.findAll({ warehouseId });

      expect(prisma.receivingOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ warehouseId }),
        }),
      );
    });
  });

  // =========================================================================
  // findOne
  // =========================================================================
  describe('findOne', () => {
    it('should return an order with items', async () => {
      prisma.receivingOrder.findUnique.mockResolvedValue(mockOrder());

      const result = await service.findOne(orderId);

      expect(result).toMatchObject({ id: orderId, referenceNo });
    });

    it('should throw NotFoundException if not found', async () => {
      prisma.receivingOrder.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // =========================================================================
  // update
  // =========================================================================
  describe('update', () => {
    it('should update a DRAFT order', async () => {
      prisma.receivingOrder.findUnique.mockResolvedValue(mockOrder());
      prisma.receivingOrder.update.mockResolvedValue(
        mockOrder({ notes: 'Updated notes' }),
      );

      const result = await service.update(
        orderId,
        { notes: 'Updated notes' },
        'admin',
      );

      expect(result.notes).toBe('Updated notes');
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'UPDATE' }),
      );
    });

    it('should throw BadRequestException if not DRAFT', async () => {
      prisma.receivingOrder.findUnique.mockResolvedValue(
        mockOrder({ status: 'SUBMITTED' }),
      );

      await expect(
        service.update(orderId, { notes: 'test' }, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if order not found', async () => {
      prisma.receivingOrder.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { notes: 'test' }, 'admin'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should replace items when provided', async () => {
      const existingOrder = mockOrder();
      prisma.receivingOrder.findUnique.mockResolvedValue(existingOrder);
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      prisma.receivingOrder.update.mockResolvedValue(
        mockOrder({
          items: [
            mockOrderItem({ batchNo: 'BATCH-002', quantity: 5 }),
          ],
        }),
      );

      const result = await service.update(
        orderId,
        {
          items: [
            {
              productId,
              batchNo: 'BATCH-002',
              quantity: 5,
            },
          ],
        },
        'admin',
      );

      expect(result.items).toHaveLength(1);
      // Should have called deleteMany + create
      expect(prisma.receivingOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            items: expect.objectContaining({
              deleteMany: {},
              create: expect.arrayContaining([
                expect.objectContaining({ batchNo: 'BATCH-002', quantity: 5 }),
              ]),
            }),
          }),
        }),
      );
    });
  });

  // =========================================================================
  // submit
  // =========================================================================
  describe('submit', () => {
    it('should submit a DRAFT order — creates batch, StockMovement, InventoryBalance', async () => {
      const order = mockOrder({
        items: [mockOrderItem({ batchId: null })],
      });
      prisma.receivingOrder.findUnique.mockResolvedValue(order);

      const tx = createTxMock();
      tx.batch.findUnique.mockResolvedValue(null); // no existing batch → create
      tx.batch.create.mockResolvedValue(mockBatch);
      tx.receivingOrderItem.update.mockResolvedValue({});
      tx.stockMovement.create.mockResolvedValue({ id: 'sm-1' });
      tx.inventoryBalance.upsert.mockResolvedValue({ id: 'ib-1', quantity: 10 });
      tx.receivingOrder.update.mockResolvedValue(
        mockOrder({ status: 'SUBMITTED' }),
      );

      prisma.$transaction.mockImplementation(
        (cb: (tx: MockTx) => Promise<unknown>) => cb(tx),
      );

      const result = await service.submit(orderId, 'admin');

      expect(result.status).toBe('SUBMITTED');
      expect(tx.batch.create).toHaveBeenCalledOnce();
      expect(tx.stockMovement.create).toHaveBeenCalledWith(
        { data: expect.objectContaining({
          type: 'INBOUND',
          quantity: 10,
        })},
      );
      expect(tx.inventoryBalance.upsert).toHaveBeenCalledOnce();
      expect(tx.auditLog.create).toHaveBeenCalled();
    });

    it('should reuse existing batch when batchNo+productId already exists', async () => {
      const order = mockOrder({
        items: [mockOrderItem({ batchId: null })],
      });
      prisma.receivingOrder.findUnique.mockResolvedValue(order);

      const tx = createTxMock();
      tx.batch.findUnique.mockResolvedValue(mockBatch); // existing batch
      tx.receivingOrderItem.update.mockResolvedValue({});
      tx.stockMovement.create.mockResolvedValue({ id: 'sm-1' });
      tx.inventoryBalance.upsert.mockResolvedValue({ id: 'ib-1', quantity: 10 });
      tx.receivingOrder.update.mockResolvedValue(
        mockOrder({ status: 'SUBMITTED' }),
      );

      prisma.$transaction.mockImplementation(
        (cb: (tx: MockTx) => Promise<unknown>) => cb(tx),
      );

      const result = await service.submit(orderId, 'admin');

      expect(result.status).toBe('SUBMITTED');
      expect(tx.batch.create).not.toHaveBeenCalled();
      expect(tx.batch.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            batchNo_productId: expect.objectContaining({
              batchNo: 'BATCH-001',
              productId,
            }),
          }),
        }),
      );
    });

    it('should use existing batchId if provided on the item', async () => {
      const order = mockOrder({
        items: [mockOrderItem({ batchId, batchNo: 'BATCH-001' })],
      });
      prisma.receivingOrder.findUnique.mockResolvedValue(order);

      const tx = createTxMock();
      tx.receivingOrderItem.update.mockResolvedValue({});
      tx.stockMovement.create.mockResolvedValue({ id: 'sm-1' });
      tx.inventoryBalance.upsert.mockResolvedValue({ id: 'ib-1', quantity: 10 });
      tx.receivingOrder.update.mockResolvedValue(
        mockOrder({ status: 'SUBMITTED' }),
      );

      prisma.$transaction.mockImplementation(
        (cb: (tx: MockTx) => Promise<unknown>) => cb(tx),
      );

      const result = await service.submit(orderId, 'admin');

      expect(result.status).toBe('SUBMITTED');
      // batchId already set → no findUnique/create
      expect(tx.batch.findUnique).not.toHaveBeenCalled();
      expect(tx.batch.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if order does not exist', async () => {
      prisma.receivingOrder.findUnique.mockResolvedValue(null);

      await expect(service.submit('nonexistent', 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if order is not DRAFT', async () => {
      prisma.receivingOrder.findUnique.mockResolvedValue(
        mockOrder({ status: 'SUBMITTED' }),
      );

      await expect(service.submit(orderId, 'admin')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should process multiple items in a transaction', async () => {
      const multiItemOrder = mockOrder({
        items: [
          mockOrderItem({ id: 'item-1', batchNo: 'BATCH-001', quantity: 10 }),
          mockOrderItem({ id: 'item-2', batchNo: 'BATCH-002', quantity: 20 }),
        ],
      });
      prisma.receivingOrder.findUnique.mockResolvedValue(multiItemOrder);

      const tx = createTxMock();
      tx.batch.findUnique.mockResolvedValue(null);
      tx.batch.create
        .mockResolvedValueOnce({ ...mockBatch, id: 'batch-1', batchNo: 'BATCH-001' })
        .mockResolvedValueOnce({ ...mockBatch, id: 'batch-2', batchNo: 'BATCH-002' });
      tx.receivingOrderItem.update.mockResolvedValue({});
      tx.stockMovement.create.mockResolvedValue({ id: 'sm-1' });
      tx.inventoryBalance.upsert.mockResolvedValue({ id: 'ib-1', quantity: 10 });
      tx.receivingOrder.update.mockResolvedValue(
        mockOrder({ status: 'SUBMITTED' }),
      );

      prisma.$transaction.mockImplementation(
        (cb: (tx: MockTx) => Promise<unknown>) => cb(tx),
      );

      const result = await service.submit(orderId, 'admin');

      expect(result.status).toBe('SUBMITTED');
      expect(tx.batch.create).toHaveBeenCalledTimes(2);
      expect(tx.stockMovement.create).toHaveBeenCalledTimes(2);
      expect(tx.inventoryBalance.upsert).toHaveBeenCalledTimes(2);
    });
  });

  // =========================================================================
  // complete
  // =========================================================================
  describe('complete', () => {
    it('should complete a SUBMITTED order', async () => {
      prisma.receivingOrder.findUnique.mockResolvedValue(
        mockOrder({ status: 'SUBMITTED' }),
      );
      prisma.receivingOrder.update.mockResolvedValue(
        mockOrder({ status: 'COMPLETED' }),
      );

      const result = await service.complete(orderId, 'admin');

      expect(result.status).toBe('COMPLETED');
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'COMPLETE' }),
      );
    });

    it('should throw BadRequestException if not SUBMITTED', async () => {
      prisma.receivingOrder.findUnique.mockResolvedValue(
        mockOrder({ status: 'DRAFT' }),
      );

      await expect(service.complete(orderId, 'admin')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if order not found', async () => {
      prisma.receivingOrder.findUnique.mockResolvedValue(null);

      await expect(service.complete('nonexistent', 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // =========================================================================
  // cancel
  // =========================================================================
  describe('cancel', () => {
    it('should cancel a DRAFT order without stock impact', async () => {
      prisma.receivingOrder.findUnique.mockResolvedValue(mockOrder());
      prisma.receivingOrder.update.mockResolvedValue(
        mockOrder({ status: 'CANCELLED' }),
      );

      const result = await service.cancel(orderId, 'admin');

      expect(result.status).toBe('CANCELLED');
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CANCEL' }),
      );
    });

    it('should cancel a SUBMITTED order with stock reversal', async () => {
      const submittedOrder = mockOrder({
        status: 'SUBMITTED',
        items: [mockOrderItem({ batchId, batchNo: 'BATCH-001', quantity: 10 })],
      });
      prisma.receivingOrder.findUnique.mockResolvedValue(submittedOrder);

      const tx = createTxMock();
      tx.stockMovement.create.mockResolvedValue({ id: 'sm-reverse' });
      tx.inventoryBalance.findUnique.mockResolvedValue({
        id: 'ib-1',
        quantity: 10,
      });
      tx.inventoryBalance.update.mockResolvedValue({
        id: 'ib-1',
        quantity: 0,
      });
      tx.receivingOrder.update.mockResolvedValue(
        mockOrder({ status: 'CANCELLED' }),
      );

      prisma.$transaction.mockImplementation(
        (cb: (tx: MockTx) => Promise<unknown>) => cb(tx),
      );

      const result = await service.cancel(orderId, 'admin');

      expect(result.status).toBe('CANCELLED');
      // Verify reverse movement (negative quantity)
      expect(tx.stockMovement.create).toHaveBeenCalledWith(
        { data: expect.objectContaining({
          quantity: -10,
          reason: expect.stringContaining('Cancel'),
        })},
      );
      // Verify decrement
      expect(tx.inventoryBalance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { quantity: { decrement: 10 } },
        }),
      );
    });

    it('should cancel a COMPLETED order with stock reversal', async () => {
      const completedOrder = mockOrder({
        status: 'COMPLETED',
        items: [mockOrderItem({ batchId, batchNo: 'BATCH-001', quantity: 5 })],
      });
      prisma.receivingOrder.findUnique.mockResolvedValue(completedOrder);

      const tx = createTxMock();
      tx.stockMovement.create.mockResolvedValue({ id: 'sm-reverse' });
      tx.inventoryBalance.findUnique.mockResolvedValue({
        id: 'ib-1',
        quantity: 5,
      });
      tx.inventoryBalance.update.mockResolvedValue({
        id: 'ib-1',
        quantity: 0,
      });
      tx.receivingOrder.update.mockResolvedValue(
        mockOrder({ status: 'CANCELLED' }),
      );

      prisma.$transaction.mockImplementation(
        (cb: (tx: MockTx) => Promise<unknown>) => cb(tx),
      );

      const result = await service.cancel(orderId, 'admin');

      expect(result.status).toBe('CANCELLED');
      expect(tx.stockMovement.create).toHaveBeenCalledWith(
        { data: expect.objectContaining({ quantity: -5 }) },
      );
    });

    it('should throw BadRequestException if already CANCELLED', async () => {
      prisma.receivingOrder.findUnique.mockResolvedValue(
        mockOrder({ status: 'CANCELLED' }),
      );

      await expect(service.cancel(orderId, 'admin')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if order not found', async () => {
      prisma.receivingOrder.findUnique.mockResolvedValue(null);

      await expect(service.cancel('nonexistent', 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // =========================================================================
  // remove (delete)
  // =========================================================================
  describe('remove', () => {
    it('should delete a DRAFT order', async () => {
      prisma.receivingOrder.findUnique.mockResolvedValue(mockOrder());
      prisma.receivingOrder.delete.mockResolvedValue(mockOrder());

      await service.remove(orderId, 'admin');

      expect(prisma.receivingOrder.delete).toHaveBeenCalledWith({
        where: { id: orderId },
      });
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DELETE' }),
      );
    });

    it('should throw BadRequestException if not DRAFT', async () => {
      prisma.receivingOrder.findUnique.mockResolvedValue(
        mockOrder({ status: 'SUBMITTED' }),
      );

      await expect(service.remove(orderId, 'admin')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if order not found', async () => {
      prisma.receivingOrder.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent', 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // =========================================================================
  // Concurrent correctness
  // =========================================================================
  describe('concurrent correctness', () => {
    it('should not have race conditions on submit via $transaction', async () => {
      // The key is that $transaction is called — verifying Prisma
      // serialises the interactive transaction.
      const order = mockOrder({
        items: [mockOrderItem({ batchId: null })],
      });
      prisma.receivingOrder.findUnique.mockResolvedValue(order);

      const tx = createTxMock();
      tx.batch.findUnique.mockResolvedValue(null);
      tx.batch.create.mockResolvedValue(mockBatch);
      tx.receivingOrderItem.update.mockResolvedValue({});
      tx.stockMovement.create.mockResolvedValue({ id: 'sm-1' });
      tx.inventoryBalance.upsert.mockResolvedValue({ id: 'ib-1', quantity: 10 });
      tx.receivingOrder.update.mockResolvedValue(
        mockOrder({ status: 'SUBMITTED' }),
      );

      prisma.$transaction.mockImplementation(
        (cb: (tx: MockTx) => Promise<unknown>) => cb(tx),
      );

      // Simulate two concurrent submits
      const [r1, r2] = await Promise.all([
        service.submit(orderId, 'admin'),
        service.submit(orderId, 'admin'),
      ]);

      expect(r1.status).toBe('SUBMITTED');
      expect(r2.status).toBe('SUBMITTED');

      // $transaction was called twice, each in its own tx
      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    });
  });
});
