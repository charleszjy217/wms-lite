import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StocktakeController } from './stocktake.controller';

describe('StocktakeController', () => {
  let controller: StocktakeController;
  let service: { [key: string]: ReturnType<typeof vi.fn> };

  const mockStocktake = {
    id: 'st-1',
    warehouseId: 'wh-1',
    locationId: 'loc-1',
    status: 'DRAFT',
    operator: 'admin',
    createdAt: new Date('2026-07-01'),
    updatedAt: new Date('2026-07-01'),
    items: [
      {
        id: 'si-1',
        productId: 'prod-1',
        batchId: 'batch-1',
        expectedQuantity: 100,
        actualQuantity: 0,
        difference: 0,
        status: 'PENDING',
        product: { id: 'prod-1', skuCode: 'SKU-001', name: 'Test' },
        batch: { id: 'batch-1', batchNo: 'B-001' },
      },
    ],
    warehouse: { id: 'wh-1', code: 'WH1' },
    location: { id: 'loc-1', code: 'L1' },
  };

  beforeEach(() => {
    service = {
      create: vi.fn(),
      findAll: vi.fn(),
      findOne: vi.fn(),
      recordCount: vi.fn(),
      confirm: vi.fn(),
      cancel: vi.fn(),
    };

    controller = new StocktakeController(service as unknown as any);
  });

  describe('create', () => {
    it('should delegate to service.create with operator from request', async () => {
      const dto = {
        warehouseId: 'wh-1',
        locationId: 'loc-1',
        items: [{ productId: 'prod-1', batchId: 'batch-1' }],
      };
      const req = { user: { username: 'admin' } };

      service.create.mockResolvedValue(mockStocktake);

      const result = await controller.create(dto, req);

      expect(result).toEqual(mockStocktake);
      expect(service.create).toHaveBeenCalledWith(dto, 'admin');
    });

    it('should use "system" when no user in request', async () => {
      const dto = {
        warehouseId: 'wh-1',
        locationId: 'loc-1',
        items: [{ productId: 'prod-1', batchId: 'batch-1' }],
      };
      const req = {};

      service.create.mockResolvedValue(mockStocktake);

      await controller.create(dto, req as any);

      expect(service.create).toHaveBeenCalledWith(dto, 'system');
    });
  });

  describe('findAll', () => {
    it('should delegate to service.findAll', async () => {
      const query = { page: 1, limit: 10 };
      const paginated = { items: [mockStocktake], total: 1, page: 1, limit: 10, totalPages: 1 };

      service.findAll.mockResolvedValue(paginated);

      const result = await controller.findAll(query);

      expect(result).toEqual(paginated);
      expect(service.findAll).toHaveBeenCalledWith(query);
    });
  });

  describe('findOne', () => {
    it('should delegate to service.findOne', async () => {
      service.findOne.mockResolvedValue(mockStocktake);

      const result = await controller.findOne('st-1');

      expect(result).toEqual(mockStocktake);
      expect(service.findOne).toHaveBeenCalledWith('st-1');
    });
  });

  describe('recordCount', () => {
    it('should delegate to service.recordCount', async () => {
      const dto = { items: [{ id: 'si-1', actualQuantity: 95 }] };
      const req = { user: { username: 'operator1' } };

      service.recordCount.mockResolvedValue({ ...mockStocktake, status: 'COUNTED' });

      const result = await controller.recordCount('st-1', dto, req);

      expect(result.status).toBe('COUNTED');
      expect(service.recordCount).toHaveBeenCalledWith('st-1', dto, 'operator1');
    });
  });

  describe('confirm', () => {
    it('should delegate to service.confirm', async () => {
      const req = { user: { username: 'operator1' } };

      service.confirm.mockResolvedValue({ ...mockStocktake, status: 'CONFIRMED' });

      const result = await controller.confirm('st-1', req);

      expect(result.status).toBe('CONFIRMED');
      expect(service.confirm).toHaveBeenCalledWith('st-1', 'operator1');
    });
  });

  describe('cancel', () => {
    it('should delegate to service.cancel', async () => {
      const req = { user: { username: 'operator1' } };

      service.cancel.mockResolvedValue({ ...mockStocktake, status: 'CANCELLED' });

      const result = await controller.cancel('st-1', req);

      expect(result.status).toBe('CANCELLED');
      expect(service.cancel).toHaveBeenCalledWith('st-1', 'operator1');
    });
  });
});
