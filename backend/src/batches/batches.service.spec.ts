import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { BatchesService } from './batches.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SortExpiryOrder } from './dto/query-batch.dto';

type MockPrisma = {
  batch: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  product: {
    findUnique: ReturnType<typeof vi.fn>;
  };
};

describe('BatchesService', () => {
  let service: BatchesService;
  let prisma: MockPrisma;
  let auditService: { log: ReturnType<typeof vi.fn> };

  const now = new Date('2026-07-04T12:00:00Z');
  const futureDate = new Date('2026-08-15T12:00:00Z'); // 42 days away
  const nearExpiryDate = new Date('2026-07-20T12:00:00Z'); // 16 days away
  const expiredDate = new Date('2026-06-01T12:00:00Z'); // already expired
  const productId = 'prod-1';
  const batchId = 'batch-1';

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

  const mockBatch = (overrides: Record<string, unknown> = {}) => ({
    id: batchId,
    batchNo: 'BATCH-001',
    productId,
    productionDate: null,
    expiryDate: null,
    status: 'ACTIVE',
    createdAt: new Date('2026-07-01'),
    updatedAt: new Date('2026-07-01'),
    product: mockProduct,
    ...overrides,
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);

    prisma = {
      batch: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      product: {
        findUnique: vi.fn(),
      },
    };

    auditService = {
      log: vi.fn(),
    };

    service = new BatchesService(
      prisma as unknown as PrismaService,
      auditService as unknown as AuditService,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('create', () => {
    const createDto = {
      batchNo: 'BATCH-001',
      productId,
      productionDate: '2026-07-01T00:00:00Z',
      expiryDate: '2026-08-15T00:00:00Z',
    };

    it('should create a batch successfully', async () => {
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      prisma.batch.findUnique.mockResolvedValue(null);
      prisma.batch.create.mockResolvedValue(mockBatch({ expiryDate: futureDate }));

      const result = await service.create(createDto, 'admin');

      expect(result).toMatchObject({
        batchNo: 'BATCH-001',
        productId,
      });
      expect(prisma.batch.create).toHaveBeenCalledOnce();
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'Batch',
          action: 'CREATE',
          operator: 'admin',
        }),
      );
    });

    it('should throw NotFoundException if product does not exist', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto, 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException if batchNo+productId already exists', async () => {
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      prisma.batch.findUnique.mockResolvedValue(mockBatch());

      await expect(service.create(createDto, 'admin')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should auto-set status to EXPIRED when expiry date is in the past', async () => {
      const pastDto = {
        ...createDto,
        expiryDate: '2026-06-01T00:00:00Z',
      };
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      prisma.batch.findUnique.mockResolvedValue(null);
      prisma.batch.create.mockResolvedValue(
        mockBatch({ expiryDate: expiredDate, status: 'EXPIRED' }),
      );

      const result = await service.create(pastDto, 'admin');

      expect(prisma.batch.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'EXPIRED' }),
        }),
      );
      expect(result).toMatchObject({ status: 'EXPIRED', isExpired: true });
    });

    it('should auto-set status to NEAR_EXPIRY when expiry is within 30 days', async () => {
      const nearDto = {
        ...createDto,
        expiryDate: '2026-07-20T00:00:00Z',
      };
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      prisma.batch.findUnique.mockResolvedValue(null);
      prisma.batch.create.mockResolvedValue(
        mockBatch({ expiryDate: nearExpiryDate, status: 'NEAR_EXPIRY' }),
      );

      const result = await service.create(nearDto, 'admin');

      expect(prisma.batch.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'NEAR_EXPIRY' }),
        }),
      );
      expect(result).toMatchObject({ status: 'NEAR_EXPIRY', isNearExpiry: true });
    });

    it('should use explicit status when provided', async () => {
      const customDto = {
        ...createDto,
        status: 'QUARANTINE',
      };
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      prisma.batch.findUnique.mockResolvedValue(null);
      prisma.batch.create.mockResolvedValue(
        mockBatch({ status: 'QUARANTINE' }),
      );

      const result = await service.create(customDto, 'admin');

      expect(prisma.batch.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'QUARANTINE' }),
        }),
      );
      expect(result.status).toBe('QUARANTINE');
    });
  });

  describe('findAll', () => {
    it('should return paginated batches', async () => {
      prisma.batch.findMany.mockResolvedValue([mockBatch({ expiryDate: futureDate })]);
      prisma.batch.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it('should filter by productId', async () => {
      prisma.batch.findMany.mockResolvedValue([]);
      prisma.batch.count.mockResolvedValue(0);

      await service.findAll({ productId });

      expect(prisma.batch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ productId }),
        }),
      );
    });

    it('should filter by batchNo (case-insensitive)', async () => {
      prisma.batch.findMany.mockResolvedValue([]);
      prisma.batch.count.mockResolvedValue(0);

      await service.findAll({ batchNo: 'batch' });

      expect(prisma.batch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            batchNo: { contains: 'batch', mode: 'insensitive' },
          }),
        }),
      );
    });

    it('should filter by expiryDate range', async () => {
      prisma.batch.findMany.mockResolvedValue([]);
      prisma.batch.count.mockResolvedValue(0);

      await service.findAll({
        expiryDateFrom: '2026-07-01T00:00:00Z',
        expiryDateTo: '2026-08-01T00:00:00Z',
      });

      expect(prisma.batch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            expiryDate: {
              gte: new Date('2026-07-01T00:00:00Z'),
              lte: new Date('2026-08-01T00:00:00Z'),
            },
          }),
        }),
      );
    });

    it('should filter nearExpiry batches', async () => {
      prisma.batch.findMany.mockResolvedValue([]);
      prisma.batch.count.mockResolvedValue(0);

      await service.findAll({ nearExpiry: true });

      const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      expect(prisma.batch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            expiryDate: {
              gte: now,
              lte: future,
            },
          }),
        }),
      );
    });

    it('should filter expired batches', async () => {
      prisma.batch.findMany.mockResolvedValue([]);
      prisma.batch.count.mockResolvedValue(0);

      await service.findAll({ expired: true });

      expect(prisma.batch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            expiryDate: {
              lt: now,
            },
          }),
        }),
      );
    });

    it('should sort by expiryDate ascending for FEFO', async () => {
      prisma.batch.findMany.mockResolvedValue([]);
      prisma.batch.count.mockResolvedValue(0);

      await service.findAll({ sortByExpiry: SortExpiryOrder.ASC });

      expect(prisma.batch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { expiryDate: 'asc' },
        }),
      );
    });

    it('should sort by expiryDate descending', async () => {
      prisma.batch.findMany.mockResolvedValue([]);
      prisma.batch.count.mockResolvedValue(0);

      await service.findAll({ sortByExpiry: SortExpiryOrder.DESC });

      expect(prisma.batch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { expiryDate: 'desc' },
        }),
      );
    });

    it('should include product relation', async () => {
      prisma.batch.findMany.mockResolvedValue([]);
      prisma.batch.count.mockResolvedValue(0);

      await service.findAll({});

      expect(prisma.batch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: { product: true },
        }),
      );
    });

    it('should return enriched expiry info for each item', async () => {
      const batchWithExpiry = mockBatch({ expiryDate: futureDate });
      prisma.batch.findMany.mockResolvedValue([batchWithExpiry]);
      prisma.batch.count.mockResolvedValue(1);

      const result = await service.findAll({});

      expect(result.items[0]).toMatchObject({
        remainingDays: 42,
        isExpired: false,
        isNearExpiry: false,
      });
    });
  });

  describe('findOne', () => {
    it('should return a batch with enriched expiry info', async () => {
      prisma.batch.findUnique.mockResolvedValue(mockBatch({ expiryDate: futureDate }));

      const result = await service.findOne(batchId);

      expect(result).toMatchObject({
        id: batchId,
        batchNo: 'BATCH-001',
        product: mockProduct,
        remainingDays: 42,
        isExpired: false,
      });
    });

    it('should throw NotFoundException if batch not found', async () => {
      prisma.batch.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should mark expired batch correctly', async () => {
      prisma.batch.findUnique.mockResolvedValue(mockBatch({ expiryDate: expiredDate }));

      const result = await service.findOne(batchId);

      expect(result).toMatchObject({
        remainingDays: -33,
        isExpired: true,
        isNearExpiry: false,
      });
    });

    it('should mark near-expiry batch correctly', async () => {
      prisma.batch.findUnique.mockResolvedValue(mockBatch({ expiryDate: nearExpiryDate }));

      const result = await service.findOne(batchId);

      expect(result).toMatchObject({
        remainingDays: 16,
        isExpired: false,
        isNearExpiry: true,
      });
    });

    it('should handle batch without expiry date', async () => {
      prisma.batch.findUnique.mockResolvedValue(mockBatch({ expiryDate: null }));

      const result = await service.findOne(batchId);

      expect(result).toMatchObject({
        remainingDays: null,
        isExpired: false,
        isNearExpiry: false,
      });
    });
  });

  describe('update', () => {
    it('should update a batch successfully', async () => {
      prisma.batch.findUnique.mockResolvedValue(mockBatch({ expiryDate: futureDate }));
      prisma.batch.update.mockResolvedValue(
        mockBatch({ batchNo: 'BATCH-002', expiryDate: futureDate }),
      );

      const result = await service.update(batchId, { batchNo: 'BATCH-002' }, 'admin');

      expect(result.batchNo).toBe('BATCH-002');
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'Batch',
          action: 'UPDATE',
          operator: 'admin',
        }),
      );
    });

    it('should throw NotFoundException if batch not found', async () => {
      prisma.batch.findUnique.mockResolvedValue(null);

      await expect(service.update('nonexistent', { batchNo: 'NEW' }, 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException if batchNo+productId conflicts', async () => {
      prisma.batch.findUnique
        .mockResolvedValueOnce(mockBatch()) // existing batch
        .mockResolvedValueOnce({ ...mockBatch(), id: 'other-batch' }); // conflict found

      await expect(
        service.update(batchId, { batchNo: 'BATCH-002' }, 'admin'),
      ).rejects.toThrow(ConflictException);
    });

    it('should recalculate status when expiryDate is updated', async () => {
      prisma.batch.findUnique.mockResolvedValue(mockBatch());
      prisma.batch.update.mockResolvedValue(
        mockBatch({ expiryDate: expiredDate, status: 'EXPIRED' }),
      );

      const result = await service.update(
        batchId,
        { expiryDate: '2026-06-01T00:00:00Z' },
        'admin',
      );

      expect(prisma.batch.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'EXPIRED' }),
        }),
      );
      expect(result.status).toBe('EXPIRED');
    });

    it('should recalculate status to NEAR_EXPIRY when expiry is near', async () => {
      prisma.batch.findUnique.mockResolvedValue(mockBatch());
      prisma.batch.update.mockResolvedValue(
        mockBatch({ expiryDate: nearExpiryDate, status: 'NEAR_EXPIRY' }),
      );

      const result = await service.update(
        batchId,
        { expiryDate: '2026-07-20T00:00:00Z' },
        'admin',
      );

      expect(prisma.batch.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'NEAR_EXPIRY' }),
        }),
      );
      expect(result.status).toBe('NEAR_EXPIRY');
    });
  });

  describe('remove', () => {
    it('should delete a batch successfully', async () => {
      prisma.batch.findUnique.mockResolvedValue(mockBatch());
      prisma.batch.delete.mockResolvedValue(mockBatch());

      await service.remove(batchId, 'admin');

      expect(prisma.batch.delete).toHaveBeenCalledWith({
        where: { id: batchId },
      });
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'Batch',
          action: 'DELETE',
          operator: 'admin',
        }),
      );
    });

    it('should throw NotFoundException if batch not found', async () => {
      prisma.batch.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent', 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('validateBatchNotExpired', () => {
    it('should pass for non-expired batch', async () => {
      prisma.batch.findUnique.mockResolvedValue(mockBatch({ expiryDate: futureDate }));

      await expect(
        service.validateBatchNotExpired(batchId),
      ).resolves.toBeUndefined();
    });

    it('should throw BadRequestException for expired batch (outbound interception)', async () => {
      prisma.batch.findUnique.mockResolvedValue(mockBatch({ expiryDate: expiredDate }));

      await expect(
        service.validateBatchNotExpired(batchId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should pass for batch without expiry date', async () => {
      prisma.batch.findUnique.mockResolvedValue(mockBatch({ expiryDate: null }));

      await expect(
        service.validateBatchNotExpired(batchId),
      ).resolves.toBeUndefined();
    });

    it('should throw NotFoundException if batch does not exist', async () => {
      prisma.batch.findUnique.mockResolvedValue(null);

      await expect(
        service.validateBatchNotExpired('nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findExpiring', () => {
    it('should return batches expiring within default 30 days', async () => {
      const nearExpBatch = mockBatch({ expiryDate: nearExpiryDate, status: 'ACTIVE' });
      prisma.batch.findMany.mockResolvedValue([nearExpBatch]);

      const result = await service.findExpiring();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        remainingDays: 16,
        isNearExpiry: true,
      });
    });

    it('should return batches expiring within custom days', async () => {
      const batchExpiringIn60 = new Date('2026-09-02T12:00:00Z'); // 60 days
      const farBatch = mockBatch({ expiryDate: batchExpiringIn60, status: 'ACTIVE' });
      prisma.batch.findMany.mockResolvedValue([farBatch]);

      const result = await service.findExpiring(60);

      expect(result).toHaveLength(1);
      expect(result[0].remainingDays).toBe(60);
    });
  });

  // ── Expiry boundary tests ────────────────────────────────

  describe('expiry boundary logic', () => {
    it('should mark batch as expired on the exact expiry date at the same time', async () => {
      // Exact expiry at current time
      const exactExpiry = new Date(now.getTime());
      prisma.batch.findUnique.mockResolvedValue(mockBatch({ expiryDate: exactExpiry }));

      const result = await service.findOne(batchId);

      expect(result.isExpired).toBe(true);
      expect(result.remainingDays).toBe(0);
    });

    it('should mark batch as NOT expired 1 millisecond before expiry', async () => {
      // 1ms before expiry
      const oneMsBefore = new Date(now.getTime() + 1);
      prisma.batch.findUnique.mockResolvedValue(mockBatch({ expiryDate: oneMsBefore }));

      const result = await service.findOne(batchId);

      expect(result.isExpired).toBe(false);
      expect(result.remainingDays).toBe(0);
    });

    it('should mark batch as NEAR_EXPIRY exactly 30 days before expiry', async () => {
      // Exactly 30 days from now (boundary)
      const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      prisma.batch.findUnique.mockResolvedValue(mockBatch({ expiryDate: thirtyDaysLater }));

      const result = await service.findOne(batchId);

      expect(result.isNearExpiry).toBe(true);
      expect(result.isExpired).toBe(false);
      expect(result.remainingDays).toBe(30);
    });

    it('should mark batch as ACTIVE 31 days before expiry', async () => {
      const thirtyOneDaysLater = new Date(now.getTime() + 31 * 24 * 60 * 60 * 1000);
      prisma.batch.findUnique.mockResolvedValue(mockBatch({ expiryDate: thirtyOneDaysLater }));

      const result = await service.findOne(batchId);

      expect(result.isNearExpiry).toBe(false);
      expect(result.isExpired).toBe(false);
      expect(result.remainingDays).toBe(31);
    });

    it('should handle negative remainingDays for past expiry', async () => {
      const pastDate = new Date('2026-06-04T12:00:00Z'); // 30 days ago
      prisma.batch.findUnique.mockResolvedValue(mockBatch({ expiryDate: pastDate }));

      const result = await service.findOne(batchId);

      expect(result.isExpired).toBe(true);
      expect(result.remainingDays).toBe(-30);
    });
  });
});
