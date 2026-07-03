import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StocktakeService } from './stocktake.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('StocktakeService', () => {
  let service: StocktakeService;
  let prisma: {
    warehouse: { findUnique: ReturnType<typeof vi.fn> };
    location: { findUnique: ReturnType<typeof vi.fn> };
    product: { findUnique: ReturnType<typeof vi.fn> };
    batch: { findUnique: ReturnType<typeof vi.fn> };
    inventoryBalance: { findUnique: ReturnType<typeof vi.fn> };
    stocktakeOrder: { create: ReturnType<typeof vi.fn>; findUnique: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn>; count: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
    stocktakeItem: { update: ReturnType<typeof vi.fn> };
    $transaction: ReturnType<typeof vi.fn>;
    $queryRawUnsafe: ReturnType<typeof vi.fn>;
    $executeRawUnsafe: ReturnType<typeof vi.fn>;
    stockMovement: { create: ReturnType<typeof vi.fn> };
  };
  let auditService: { log: ReturnType<typeof vi.fn> };

  const mockStocktake = {
    id: 'st-1',
    warehouseId: 'wh-1',
    locationId: 'loc-1',
    referenceNo: 'ST-001',
    status: 'DRAFT',
    operator: 'admin',
    createdAt: new Date('2026-07-01'),
    updatedAt: new Date('2026-07-01'),
    items: [
      {
        id: 'si-1',
        stocktakeOrderId: 'st-1',
        productId: 'prod-1',
        batchId: 'batch-1',
        expectedQuantity: 100,
        actualQuantity: 0,
        difference: 0,
        status: 'PENDING',
      },
    ],
  };

  const mockCountedStocktake = {
    ...mockStocktake,
    status: 'COUNTED',
    items: mockStocktake.items.map((i) => ({
      ...i,
      actualQuantity: 95,
      difference: -5,
      status: 'MISMATCH' as const,
    })),
  };

  const mockConfirmedStocktake = {
    ...mockCountedStocktake,
    status: 'CONFIRMED',
    items: mockCountedStocktake.items.map((i) => ({
      ...i,
      status: 'ADJUSTED' as const,
    })),
  };

  beforeEach(() => {
    prisma = {
      warehouse: { findUnique: vi.fn() },
      location: { findUnique: vi.fn() },
      product: { findUnique: vi.fn() },
      batch: { findUnique: vi.fn() },
      inventoryBalance: { findUnique: vi.fn() },
      stocktakeOrder: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
      },
      stocktakeItem: { update: vi.fn() },
      $transaction: vi.fn(),
      $queryRawUnsafe: vi.fn(),
      $executeRawUnsafe: vi.fn(),
      stockMovement: { create: vi.fn() },
    };

    auditService = { log: vi.fn() };

    service = new StocktakeService(
      prisma as unknown as any,
      auditService as unknown as any,
    );
  });

  describe('create', () => {
    it('should create a DRAFT stocktake with expected quantities from balance', async () => {
      prisma.warehouse.findUnique.mockResolvedValue({ id: 'wh-1' });
      prisma.location.findUnique.mockResolvedValue({ id: 'loc-1' });
      prisma.product.findUnique.mockResolvedValue({ id: 'prod-1' });
      prisma.batch.findUnique.mockResolvedValue({ id: 'batch-1' });
      prisma.inventoryBalance.findUnique.mockResolvedValue({ id: 'bal-1', quantity: 100 });
      prisma.stocktakeOrder.create.mockResolvedValue(mockStocktake);

      const result = await service.create(
        {
          warehouseId: 'wh-1',
          locationId: 'loc-1',
          referenceNo: 'ST-001',
          items: [{ productId: 'prod-1', batchId: 'batch-1' }],
        },
        'admin',
      );

      expect(result).toEqual(mockStocktake);
      expect(prisma.stocktakeOrder.create).toHaveBeenCalled();
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ entityType: 'StocktakeOrder', action: 'CREATE' }),
      );
    });

    it('should use 0 as expected quantity when no balance exists', async () => {
      prisma.warehouse.findUnique.mockResolvedValue({ id: 'wh-1' });
      prisma.location.findUnique.mockResolvedValue({ id: 'loc-1' });
      prisma.product.findUnique.mockResolvedValue({ id: 'prod-1' });
      prisma.batch.findUnique.mockResolvedValue({ id: 'batch-1' });
      prisma.inventoryBalance.findUnique.mockResolvedValue(null);
      prisma.stocktakeOrder.create.mockResolvedValue(mockStocktake);

      await service.create(
        {
          warehouseId: 'wh-1',
          locationId: 'loc-1',
          items: [{ productId: 'prod-1', batchId: 'batch-1' }],
        },
        'admin',
      );

      const createCall = prisma.stocktakeOrder.create.mock.calls[0][0];
      expect(createCall.data.items.create[0].expectedQuantity).toBe(0);
    });

    it('should throw when warehouse not found', async () => {
      prisma.warehouse.findUnique.mockResolvedValue(null);

      await expect(
        service.create(
          {
            warehouseId: 'bad-wh',
            locationId: 'loc-1',
            items: [{ productId: 'prod-1', batchId: 'batch-1' }],
          },
          'admin',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw when product not found', async () => {
      prisma.warehouse.findUnique.mockResolvedValue({ id: 'wh-1' });
      prisma.location.findUnique.mockResolvedValue({ id: 'loc-1' });
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(
        service.create(
          {
            warehouseId: 'wh-1',
            locationId: 'loc-1',
            items: [{ productId: 'bad-prod', batchId: 'batch-1' }],
          },
          'admin',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('recordCount', () => {
    it('should update actual quantities and compute differences', async () => {
      prisma.stocktakeOrder.findUnique.mockResolvedValue(mockStocktake);

      prisma.$transaction.mockImplementation(async (cb: Function) => {
        const tx = {
          stocktakeItem: { update: vi.fn().mockResolvedValue({}) },
        };
        return cb(tx);
      });

      prisma.stocktakeOrder.update.mockResolvedValue(mockCountedStocktake);

      const result = await service.recordCount(
        'st-1',
        { items: [{ id: 'si-1', actualQuantity: 95 }] },
        'admin',
      );

      expect(result.status).toBe('COUNTED');
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ entityType: 'StocktakeOrder', action: 'RECORD_COUNT' }),
      );
    });

    it('should throw when stocktake not found', async () => {
      prisma.stocktakeOrder.findUnique.mockResolvedValue(null);

      await expect(
        service.recordCount('bad-id', { items: [{ id: 'si-1', actualQuantity: 95 }] }, 'admin'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw when stocktake is not DRAFT', async () => {
      prisma.stocktakeOrder.findUnique.mockResolvedValue(mockCountedStocktake);

      await expect(
        service.recordCount('st-1', { items: [{ id: 'si-1', actualQuantity: 95 }] }, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when item id does not belong to the stocktake', async () => {
      prisma.stocktakeOrder.findUnique.mockResolvedValue(mockStocktake);

      prisma.$transaction.mockImplementation(async (cb: Function) => {
        const tx = {
          stocktakeItem: { update: vi.fn() },
        };
        return cb(tx);
      });

      await expect(
        service.recordCount(
          'st-1',
          { items: [{ id: 'invalid-item', actualQuantity: 95 }] },
          'admin',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('confirm', () => {
    it('should adjust inventory for differences', async () => {
      prisma.stocktakeOrder.findUnique
        .mockResolvedValueOnce(mockCountedStocktake)
        .mockResolvedValueOnce(mockConfirmedStocktake);

      prisma.$transaction.mockImplementation(async (cb: Function) => {
        const tx = {
          $queryRawUnsafe: vi.fn().mockResolvedValue([{ id: 'bal-1', quantity: 100 }]),
          $executeRawUnsafe: vi.fn(),
          stockMovement: { create: vi.fn() },
          stocktakeItem: { update: vi.fn() },
          stocktakeOrder: { update: vi.fn() },
        };
        return cb(tx);
      });

      const result = await service.confirm('st-1', 'admin');

      expect(result.status).toBe('CONFIRMED');
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ entityType: 'StocktakeOrder', action: 'CONFIRM' }),
      );
    });

    it('should throw when stocktake not found', async () => {
      prisma.stocktakeOrder.findUnique.mockResolvedValue(null);

      await expect(service.confirm('bad-id', 'admin')).rejects.toThrow(NotFoundException);
    });

    it('should throw when stocktake is not COUNTED', async () => {
      prisma.stocktakeOrder.findUnique.mockResolvedValue(mockStocktake);

      await expect(service.confirm('st-1', 'admin')).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancel', () => {
    it('should cancel a DRAFT stocktake', async () => {
      prisma.stocktakeOrder.findUnique
        .mockResolvedValueOnce(mockStocktake)
        .mockResolvedValueOnce({ ...mockStocktake, status: 'CANCELLED' });

      prisma.stocktakeOrder.update.mockResolvedValue({ ...mockStocktake, status: 'CANCELLED' });

      const result = await service.cancel('st-1', 'admin');

      expect(result.status).toBe('CANCELLED');
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ entityType: 'StocktakeOrder', action: 'CANCEL' }),
      );
    });

    it('should throw when already CONFIRMED', async () => {
      prisma.stocktakeOrder.findUnique.mockResolvedValue(mockConfirmedStocktake);

      await expect(service.cancel('st-1', 'admin')).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return paginated results', async () => {
      prisma.stocktakeOrder.findMany.mockResolvedValue([mockStocktake]);
      prisma.stocktakeOrder.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('findOne', () => {
    it('should return a stocktake by id', async () => {
      prisma.stocktakeOrder.findUnique.mockResolvedValue(mockStocktake);

      const result = await service.findOne('st-1');

      expect(result).toEqual(mockStocktake);
    });

    it('should throw when not found', async () => {
      prisma.stocktakeOrder.findUnique.mockResolvedValue(null);

      await expect(service.findOne('bad-id')).rejects.toThrow(NotFoundException);
    });
  });
});
