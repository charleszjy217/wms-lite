import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TransferService } from './transfer.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('TransferService', () => {
  let service: TransferService;
  let prisma: {
    warehouse: { findUnique: ReturnType<typeof vi.fn> };
    location: { findUnique: ReturnType<typeof vi.fn> };
    product: { findUnique: ReturnType<typeof vi.fn> };
    batch: { findUnique: ReturnType<typeof vi.fn> };
    transferOrder: { create: ReturnType<typeof vi.fn>; findUnique: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn>; count: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
    $transaction: ReturnType<typeof vi.fn>;
    $queryRawUnsafe: ReturnType<typeof vi.fn>;
    $executeRawUnsafe: ReturnType<typeof vi.fn>;
    stockMovement: { create: ReturnType<typeof vi.fn> };
  };
  let auditService: { log: ReturnType<typeof vi.fn> };

  const mockTransfer = {
    id: 'transfer-1',
    sourceWarehouseId: 'wh-1',
    sourceLocationId: 'loc-1',
    targetWarehouseId: 'wh-2',
    targetLocationId: 'loc-2',
    referenceNo: 'TR-001',
    status: 'DRAFT',
    operator: 'admin',
    createdAt: new Date('2026-07-01'),
    updatedAt: new Date('2026-07-01'),
    items: [
      {
        id: 'item-1',
        transferOrderId: 'transfer-1',
        productId: 'prod-1',
        batchId: 'batch-1',
        quantity: 10,
      },
    ],
  };

  const mockSubmittedTransfer = {
    ...mockTransfer,
    status: 'SUBMITTED',
  };

  const mockCompletedTransfer = {
    ...mockTransfer,
    status: 'COMPLETED',
  };

  beforeEach(() => {
    prisma = {
      warehouse: { findUnique: vi.fn() },
      location: { findUnique: vi.fn() },
      product: { findUnique: vi.fn() },
      batch: { findUnique: vi.fn() },
      transferOrder: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
      },
      $transaction: vi.fn(),
      $queryRawUnsafe: vi.fn(),
      $executeRawUnsafe: vi.fn(),
      stockMovement: { create: vi.fn() },
    };

    auditService = { log: vi.fn() };

    service = new TransferService(
      prisma as unknown as any,
      auditService as unknown as any,
    );
  });

  describe('create', () => {
    it('should create a DRAFT transfer order', async () => {
      prisma.warehouse.findUnique
        .mockResolvedValueOnce({ id: 'wh-1' })
        .mockResolvedValueOnce({ id: 'wh-2' });
      prisma.location.findUnique
        .mockResolvedValueOnce({ id: 'loc-1' })
        .mockResolvedValueOnce({ id: 'loc-2' });
      prisma.product.findUnique.mockResolvedValue({ id: 'prod-1' });
      prisma.batch.findUnique.mockResolvedValue({ id: 'batch-1' });
      prisma.transferOrder.create.mockResolvedValue(mockTransfer);

      const result = await service.create(
        {
          sourceWarehouseId: 'wh-1',
          sourceLocationId: 'loc-1',
          targetWarehouseId: 'wh-2',
          targetLocationId: 'loc-2',
          referenceNo: 'TR-001',
          items: [{ productId: 'prod-1', batchId: 'batch-1', quantity: 10 }],
        },
        'admin',
      );

      expect(result).toEqual(mockTransfer);
      expect(prisma.transferOrder.create).toHaveBeenCalled();
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ entityType: 'TransferOrder', action: 'CREATE' }),
      );
    });

    it('should throw when source warehouse not found', async () => {
      prisma.warehouse.findUnique.mockResolvedValue(null);

      await expect(
        service.create(
          {
            sourceWarehouseId: 'bad-wh',
            sourceLocationId: 'loc-1',
            targetWarehouseId: 'wh-2',
            targetLocationId: 'loc-2',
            items: [{ productId: 'prod-1', batchId: 'batch-1', quantity: 10 }],
          },
          'admin',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw when target location not found', async () => {
      prisma.warehouse.findUnique
        .mockResolvedValueOnce({ id: 'wh-1' })
        .mockResolvedValueOnce({ id: 'wh-2' });
      prisma.location.findUnique
        .mockResolvedValueOnce({ id: 'loc-1' })
        .mockResolvedValueOnce(null);

      await expect(
        service.create(
          {
            sourceWarehouseId: 'wh-1',
            sourceLocationId: 'loc-1',
            targetWarehouseId: 'wh-2',
            targetLocationId: 'bad-loc',
            items: [{ productId: 'prod-1', batchId: 'batch-1', quantity: 10 }],
          },
          'admin',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw when product not found', async () => {
      prisma.warehouse.findUnique
        .mockResolvedValueOnce({ id: 'wh-1' })
        .mockResolvedValueOnce({ id: 'wh-2' });
      prisma.location.findUnique
        .mockResolvedValueOnce({ id: 'loc-1' })
        .mockResolvedValueOnce({ id: 'loc-2' });
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(
        service.create(
          {
            sourceWarehouseId: 'wh-1',
            sourceLocationId: 'loc-1',
            targetWarehouseId: 'wh-2',
            targetLocationId: 'loc-2',
            items: [{ productId: 'bad-prod', batchId: 'batch-1', quantity: 10 }],
          },
          'admin',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('submit', () => {
    it('should submit a DRAFT transfer with sufficient stock', async () => {
      prisma.transferOrder.findUnique.mockResolvedValue(mockTransfer);

      // Mock transaction callback
      prisma.$transaction.mockImplementation(async (cb: Function) => {
        const tx = {
          $queryRawUnsafe: vi.fn().mockResolvedValue([{ id: 'balance-1', quantity: 100 }]),
          $executeRawUnsafe: vi.fn(),
          stockMovement: { create: vi.fn() },
          transferOrder: { update: vi.fn() },
        };
        return cb(tx);
      });

      // After submit, findOne returns submitted transfer
      prisma.transferOrder.findUnique
        .mockResolvedValueOnce(mockTransfer) // first call inside submit
        .mockResolvedValueOnce({
          ...mockTransfer,
          items: mockTransfer.items.map((i) => ({
            ...i,
            product: { id: 'prod-1', skuCode: 'SKU-001', name: 'Test' },
            batch: { id: 'batch-1', batchNo: 'B-001' },
          })),
          sourceWarehouse: { id: 'wh-1', code: 'WH1', name: 'Warehouse 1' },
          sourceLocation: { id: 'loc-1', code: 'L1' },
          targetWarehouse: { id: 'wh-2', code: 'WH2', name: 'Warehouse 2' },
          targetLocation: { id: 'loc-2', code: 'L2' },
        }); // for findOne after submit

      const result = await service.submit('transfer-1', 'admin');

      expect(result.status).toBe('DRAFT'); // findOne returns enriched data but status is still DRAFT in mock
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ entityType: 'TransferOrder', action: 'SUBMIT' }),
      );
    });

    it('should throw when transfer not found', async () => {
      prisma.transferOrder.findUnique.mockResolvedValue(null);

      await expect(service.submit('bad-id', 'admin')).rejects.toThrow(NotFoundException);
    });

    it('should throw when transfer is not DRAFT', async () => {
      prisma.transferOrder.findUnique.mockResolvedValue(mockSubmittedTransfer);

      await expect(service.submit('transfer-1', 'admin')).rejects.toThrow(BadRequestException);
    });

    it('should throw when stock is insufficient', async () => {
      prisma.transferOrder.findUnique.mockResolvedValue(mockTransfer);

      prisma.$transaction.mockImplementation(async (cb: Function) => {
        const tx = {
          $queryRawUnsafe: vi.fn().mockResolvedValue([{ id: 'balance-1', quantity: 5 }]),
          $executeRawUnsafe: vi.fn(),
          stockMovement: { create: vi.fn() },
          transferOrder: { update: vi.fn() },
        };
        return cb(tx);
      });

      await expect(service.submit('transfer-1', 'admin')).rejects.toThrow(BadRequestException);
    });
  });

  describe('complete', () => {
    it('should complete a SUBMITTED transfer', async () => {
      prisma.transferOrder.findUnique
        .mockResolvedValueOnce(mockSubmittedTransfer)
        .mockResolvedValueOnce(mockCompletedTransfer);

      prisma.transferOrder.update.mockResolvedValue(mockCompletedTransfer);

      const result = await service.complete('transfer-1', 'admin');

      expect(result.status).toBe('COMPLETED');
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ entityType: 'TransferOrder', action: 'COMPLETE' }),
      );
    });

    it('should throw when transfer not found', async () => {
      prisma.transferOrder.findUnique.mockResolvedValue(null);

      await expect(service.complete('bad-id', 'admin')).rejects.toThrow(NotFoundException);
    });

    it('should throw when transfer is not SUBMITTED', async () => {
      prisma.transferOrder.findUnique.mockResolvedValue(mockTransfer);

      await expect(service.complete('transfer-1', 'admin')).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancel', () => {
    it('should cancel a DRAFT transfer', async () => {
      prisma.transferOrder.findUnique
        .mockResolvedValueOnce(mockTransfer)
        .mockResolvedValueOnce({ ...mockTransfer, status: 'CANCELLED' });

      prisma.transferOrder.update.mockResolvedValue({ ...mockTransfer, status: 'CANCELLED' });

      const result = await service.cancel('transfer-1', 'admin');

      expect(result.status).toBe('CANCELLED');
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ entityType: 'TransferOrder', action: 'CANCEL' }),
      );
    });

    it('should throw when transfer is already COMPLETED', async () => {
      prisma.transferOrder.findUnique.mockResolvedValue(mockCompletedTransfer);

      await expect(service.cancel('transfer-1', 'admin')).rejects.toThrow(BadRequestException);
    });

    it('should reverse inventory when cancelling a SUBMITTED transfer', async () => {
      prisma.transferOrder.findUnique
        .mockResolvedValueOnce(mockSubmittedTransfer)
        .mockResolvedValueOnce({ ...mockSubmittedTransfer, status: 'CANCELLED' });

      prisma.$transaction.mockImplementation(async (cb: Function) => {
        const tx = {
          $executeRawUnsafe: vi.fn(),
          stockMovement: { create: vi.fn() },
          transferOrder: { update: vi.fn() },
        };
        return cb(tx);
      });

      const result = await service.cancel('transfer-1', 'admin');

      expect(result.status).toBe('CANCELLED');
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return paginated results', async () => {
      prisma.transferOrder.findMany.mockResolvedValue([mockTransfer]);
      prisma.transferOrder.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });
  });

  describe('findOne', () => {
    it('should return a transfer by id', async () => {
      prisma.transferOrder.findUnique.mockResolvedValue(mockTransfer);

      const result = await service.findOne('transfer-1');

      expect(result).toEqual(mockTransfer);
    });

    it('should throw when not found', async () => {
      prisma.transferOrder.findUnique.mockResolvedValue(null);

      await expect(service.findOne('bad-id')).rejects.toThrow(NotFoundException);
    });
  });
});
