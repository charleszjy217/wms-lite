import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BatchesController } from './batches.controller';
import { BatchesService } from './batches.service';

describe('BatchesController', () => {
  let controller: BatchesController;
  let service: { [key: string]: ReturnType<typeof vi.fn> };

  const mockBatch = {
    id: 'batch-1',
    batchNo: 'BATCH-001',
    productId: 'prod-1',
    productionDate: new Date('2026-07-01'),
    expiryDate: new Date('2026-08-15'),
    status: 'ACTIVE',
    remainingDays: 42,
    isExpired: false,
    isNearExpiry: false,
    createdAt: new Date('2026-07-01'),
    updatedAt: new Date('2026-07-01'),
    product: {
      id: 'prod-1',
      skuCode: 'SKU-001',
      name: '测试商品',
    },
  };

  beforeEach(() => {
    service = {
      create: vi.fn(),
      findAll: vi.fn(),
      findOne: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      findExpiring: vi.fn(),
      validateBatchNotExpired: vi.fn(),
    };

    controller = new BatchesController(service as unknown as BatchesService);
  });

  describe('create', () => {
    it('should delegate to service.create with operator from request', async () => {
      const dto = {
        batchNo: 'BATCH-001',
        productId: 'prod-1',
      };
      const req = { user: { username: 'admin' } };

      service.create.mockResolvedValue(mockBatch);

      const result = await controller.create(dto, req);

      expect(result).toEqual(mockBatch);
      expect(service.create).toHaveBeenCalledWith(dto, 'admin');
    });

    it('should use "system" when no user in request', async () => {
      const dto = {
        batchNo: 'BATCH-001',
        productId: 'prod-1',
      };
      const req = {};

      service.create.mockResolvedValue(mockBatch);

      await controller.create(dto, req as { user?: { username: string } });

      expect(service.create).toHaveBeenCalledWith(dto, 'system');
    });
  });

  describe('findAll', () => {
    it('should delegate to service.findAll with query', async () => {
      const query = { page: 1, limit: 10, productId: 'prod-1' };
      const paginatedResult = {
        items: [mockBatch],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      };

      service.findAll.mockResolvedValue(paginatedResult);

      const result = await controller.findAll(query);

      expect(result).toEqual(paginatedResult);
      expect(service.findAll).toHaveBeenCalledWith(query);
    });
  });

  describe('findOne', () => {
    it('should delegate to service.findOne with id', async () => {
      service.findOne.mockResolvedValue(mockBatch);

      const result = await controller.findOne('batch-1');

      expect(result).toEqual(mockBatch);
      expect(service.findOne).toHaveBeenCalledWith('batch-1');
    });
  });

  describe('update', () => {
    it('should delegate to service.update with id, dto, and operator', async () => {
      const dto = { batchNo: 'BATCH-002' };
      const req = { user: { username: 'operator1' } };

      service.update.mockResolvedValue({ ...mockBatch, batchNo: 'BATCH-002' });

      const result = await controller.update('batch-1', dto, req);

      expect(result.batchNo).toBe('BATCH-002');
      expect(service.update).toHaveBeenCalledWith('batch-1', dto, 'operator1');
    });
  });

  describe('remove', () => {
    it('should delegate to service.remove with id and operator', async () => {
      const req = { user: { username: 'admin' } };

      service.remove.mockResolvedValue(undefined);

      await controller.remove('batch-1', req);

      expect(service.remove).toHaveBeenCalledWith('batch-1', 'admin');
    });

    it('should return no content on successful delete', async () => {
      const req = { user: { username: 'admin' } };

      service.remove.mockResolvedValue(undefined);

      const result = await controller.remove('batch-1', req);

      expect(result).toBeUndefined();
    });
  });

  describe('findExpiring', () => {
    it('should delegate to service.findExpiring with default 30 days', async () => {
      service.findExpiring.mockResolvedValue([mockBatch]);

      const result = await controller.findExpiring(undefined);

      expect(result).toEqual([mockBatch]);
      expect(service.findExpiring).toHaveBeenCalledWith(30);
    });

    it('should delegate to service.findExpiring with custom days', async () => {
      service.findExpiring.mockResolvedValue([mockBatch]);

      const result = await controller.findExpiring('60');

      expect(result).toEqual([mockBatch]);
      expect(service.findExpiring).toHaveBeenCalledWith(60);
    });
  });

  describe('validateOutbound', () => {
    it('should return valid when batch is not expired', async () => {
      service.validateBatchNotExpired.mockResolvedValue(undefined);

      const result = await controller.validateOutbound('batch-1');

      expect(result).toEqual({ valid: true, message: '批次可用于出库' });
      expect(service.validateBatchNotExpired).toHaveBeenCalledWith('batch-1');
    });
  });
});
