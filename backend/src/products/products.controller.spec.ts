import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

describe('ProductsController', () => {
  let controller: ProductsController;
  let service: { [key: string]: ReturnType<typeof vi.fn> };

  const mockProduct = {
    id: 'prod-1',
    skuCode: 'SKU-001',
    name: '测试商品',
    description: '测试描述',
    categoryId: null,
    brand: '测试品牌',
    unitOfMeasure: 'PCS',
    barcode: '6901234567890',
    specifications: { color: 'red' },
    status: 'ACTIVE',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  beforeEach(() => {
    service = {
      create: vi.fn(),
      findAll: vi.fn(),
      findOne: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };

    controller = new ProductsController(service as unknown as ProductsService);
  });

  describe('create', () => {
    it('should delegate to service.create with operator from request', async () => {
      const dto = {
        skuCode: 'SKU-001',
        name: '测试商品',
        unitOfMeasure: 'PCS',
      };
      const req = { user: { username: 'admin' } };

      service.create.mockResolvedValue(mockProduct);

      const result = await controller.create(dto, req);

      expect(result).toEqual(mockProduct);
      expect(service.create).toHaveBeenCalledWith(dto, 'admin');
    });

    it('should use "system" when no user in request', async () => {
      const dto = {
        skuCode: 'SKU-001',
        name: '测试商品',
        unitOfMeasure: 'PCS',
      };
      const req = {};

      service.create.mockResolvedValue(mockProduct);

      await controller.create(dto, req as { user?: { username: string } });

      expect(service.create).toHaveBeenCalledWith(dto, 'system');
    });
  });

  describe('findAll', () => {
    it('should delegate to service.findAll with query', async () => {
      const query = { page: 1, limit: 10, name: '测试' };
      const paginatedResult = {
        items: [mockProduct],
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
      service.findOne.mockResolvedValue(mockProduct);

      const result = await controller.findOne('prod-1');

      expect(result).toEqual(mockProduct);
      expect(service.findOne).toHaveBeenCalledWith('prod-1');
    });
  });

  describe('update', () => {
    it('should delegate to service.update with id, dto, and operator', async () => {
      const dto = { name: '更新' };
      const req = { user: { username: 'operator1' } };

      service.update.mockResolvedValue({ ...mockProduct, name: '更新' });

      const result = await controller.update('prod-1', dto, req);

      expect(result.name).toBe('更新');
      expect(service.update).toHaveBeenCalledWith('prod-1', dto, 'operator1');
    });
  });

  describe('remove', () => {
    it('should delegate to service.remove with id and operator', async () => {
      const req = { user: { username: 'admin' } };

      service.remove.mockResolvedValue(undefined);

      await controller.remove('prod-1', req);

      expect(service.remove).toHaveBeenCalledWith('prod-1', 'admin');
    });

    it('should return no content on successful delete', async () => {
      const req = { user: { username: 'admin' } };

      service.remove.mockResolvedValue(undefined);

      const result = await controller.remove('prod-1', req);

      expect(result).toBeUndefined();
    });
  });
});
