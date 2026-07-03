import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TransferController } from './transfer.controller';

describe('TransferController', () => {
  let controller: TransferController;
  let service: { [key: string]: ReturnType<typeof vi.fn> };

  const mockTransfer = {
    id: 'transfer-1',
    sourceWarehouseId: 'wh-1',
    sourceLocationId: 'loc-1',
    targetWarehouseId: 'wh-2',
    targetLocationId: 'loc-2',
    status: 'DRAFT',
    operator: 'admin',
    createdAt: new Date('2026-07-01'),
    updatedAt: new Date('2026-07-01'),
    items: [
      {
        id: 'item-1',
        productId: 'prod-1',
        batchId: 'batch-1',
        quantity: 10,
        product: { id: 'prod-1', skuCode: 'SKU-001', name: 'Test' },
        batch: { id: 'batch-1', batchNo: 'B-001' },
      },
    ],
    sourceWarehouse: { id: 'wh-1', code: 'WH1' },
    sourceLocation: { id: 'loc-1', code: 'L1' },
    targetWarehouse: { id: 'wh-2', code: 'WH2' },
    targetLocation: { id: 'loc-2', code: 'L2' },
  };

  beforeEach(() => {
    service = {
      create: vi.fn(),
      findAll: vi.fn(),
      findOne: vi.fn(),
      submit: vi.fn(),
      complete: vi.fn(),
      cancel: vi.fn(),
    };

    controller = new TransferController(service as unknown as any);
  });

  describe('create', () => {
    it('should delegate to service.create with operator from request', async () => {
      const dto = {
        sourceWarehouseId: 'wh-1',
        sourceLocationId: 'loc-1',
        targetWarehouseId: 'wh-2',
        targetLocationId: 'loc-2',
        items: [{ productId: 'prod-1', batchId: 'batch-1', quantity: 10 }],
      };
      const req = { user: { username: 'admin' } };

      service.create.mockResolvedValue(mockTransfer);

      const result = await controller.create(dto, req);

      expect(result).toEqual(mockTransfer);
      expect(service.create).toHaveBeenCalledWith(dto, 'admin');
    });

    it('should use "system" when no user in request', async () => {
      const dto = {
        sourceWarehouseId: 'wh-1',
        sourceLocationId: 'loc-1',
        targetWarehouseId: 'wh-2',
        targetLocationId: 'loc-2',
        items: [{ productId: 'prod-1', batchId: 'batch-1', quantity: 10 }],
      };
      const req = {};

      service.create.mockResolvedValue(mockTransfer);

      await controller.create(dto, req as any);

      expect(service.create).toHaveBeenCalledWith(dto, 'system');
    });
  });

  describe('findAll', () => {
    it('should delegate to service.findAll with query', async () => {
      const query = { page: 1, limit: 10, status: 'DRAFT' };
      const paginated = { items: [mockTransfer], total: 1, page: 1, limit: 10, totalPages: 1 };

      service.findAll.mockResolvedValue(paginated);

      const result = await controller.findAll(query);

      expect(result).toEqual(paginated);
      expect(service.findAll).toHaveBeenCalledWith(query);
    });
  });

  describe('findOne', () => {
    it('should delegate to service.findOne', async () => {
      service.findOne.mockResolvedValue(mockTransfer);

      const result = await controller.findOne('transfer-1');

      expect(result).toEqual(mockTransfer);
      expect(service.findOne).toHaveBeenCalledWith('transfer-1');
    });
  });

  describe('submit', () => {
    it('should delegate to service.submit', async () => {
      const req = { user: { username: 'operator1' } };

      service.submit.mockResolvedValue({ ...mockTransfer, status: 'SUBMITTED' });

      const result = await controller.submit('transfer-1', req);

      expect(result.status).toBe('SUBMITTED');
      expect(service.submit).toHaveBeenCalledWith('transfer-1', 'operator1');
    });
  });

  describe('complete', () => {
    it('should delegate to service.complete', async () => {
      const req = { user: { username: 'operator1' } };

      service.complete.mockResolvedValue({ ...mockTransfer, status: 'COMPLETED' });

      const result = await controller.complete('transfer-1', req);

      expect(result.status).toBe('COMPLETED');
      expect(service.complete).toHaveBeenCalledWith('transfer-1', 'operator1');
    });
  });

  describe('cancel', () => {
    it('should delegate to service.cancel', async () => {
      const req = { user: { username: 'operator1' } };

      service.cancel.mockResolvedValue({ ...mockTransfer, status: 'CANCELLED' });

      const result = await controller.cancel('transfer-1', req);

      expect(result.status).toBe('CANCELLED');
      expect(service.cancel).toHaveBeenCalledWith('transfer-1', 'operator1');
    });
  });
});
