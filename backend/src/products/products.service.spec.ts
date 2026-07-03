import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

type MockPrisma = {
  product: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
};

describe('ProductsService', () => {
  let service: ProductsService;
  let prisma: MockPrisma;
  let auditService: { log: ReturnType<typeof vi.fn> };

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
    prisma = {
      product: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };

    auditService = {
      log: vi.fn(),
    };

    service = new ProductsService(
      prisma as unknown as PrismaService,
      auditService as unknown as AuditService,
    );
  });

  describe('create', () => {
    const createDto = {
      skuCode: 'SKU-001',
      name: '测试商品',
      description: '测试描述',
      brand: '测试品牌',
      unitOfMeasure: 'PCS',
      barcode: '6901234567890',
      specifications: { color: 'red' },
    };

    it('should create a product successfully', async () => {
      prisma.product.findUnique.mockResolvedValue(null);
      prisma.product.create.mockResolvedValue(mockProduct);

      const result = await service.create(createDto, 'admin');

      expect(result).toEqual(mockProduct);
      expect(prisma.product.create).toHaveBeenCalledOnce();
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'Product',
          action: 'CREATE',
          operator: 'admin',
        }),
      );
    });

    it('should throw ConflictException if skuCode exists', async () => {
      prisma.product.findUnique.mockResolvedValueOnce(mockProduct);

      await expect(service.create(createDto, 'admin')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException if barcode exists', async () => {
      prisma.product.findUnique
        .mockResolvedValueOnce(null) // skuCode check passes
        .mockResolvedValueOnce(mockProduct); // barcode conflict

      await expect(service.create(createDto, 'admin')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should create product without optional fields', async () => {
      const minimalDto = {
        skuCode: 'SKU-002',
        name: '简约商品',
        unitOfMeasure: 'PCS',
      };

      prisma.product.findUnique.mockResolvedValue(null);
      prisma.product.create.mockResolvedValue({
        ...mockProduct,
        id: 'prod-2',
        skuCode: 'SKU-002',
        name: '简约商品',
        barcode: null,
        specifications: null,
        description: null,
        brand: null,
        categoryId: null,
      });

      const result = await service.create(minimalDto, 'operator1');

      expect(result.skuCode).toBe('SKU-002');
      expect(auditService.log).toHaveBeenCalledOnce();
    });
  });

  describe('findAll', () => {
    it('should return paginated products', async () => {
      prisma.product.findMany.mockResolvedValue([mockProduct]);
      prisma.product.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.items).toEqual([mockProduct]);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it('should filter by name', async () => {
      prisma.product.findMany.mockResolvedValue([mockProduct]);
      prisma.product.count.mockResolvedValue(1);

      await service.findAll({ name: '测试' });

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            name: { contains: '测试', mode: 'insensitive' },
          }),
        }),
      );
    });

    it('should filter by skuCode', async () => {
      prisma.product.findMany.mockResolvedValue([mockProduct]);
      prisma.product.count.mockResolvedValue(1);

      await service.findAll({ skuCode: 'SKU-001' });

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            skuCode: { contains: 'SKU-001', mode: 'insensitive' },
          }),
        }),
      );
    });

    it('should filter by categoryId', async () => {
      prisma.product.findMany.mockResolvedValue([mockProduct]);
      prisma.product.count.mockResolvedValue(1);

      await service.findAll({ categoryId: 'cat-1' });

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            categoryId: 'cat-1',
          }),
        }),
      );
    });

    it('should return empty list when no products match', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      prisma.product.count.mockResolvedValue(0);

      const result = await service.findAll({ name: 'nonexistent' });

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });

    it('should apply default pagination when not specified', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      prisma.product.count.mockResolvedValue(0);

      await service.findAll({});

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
        }),
      );
    });

    it('should include category relation', async () => {
      prisma.product.findMany.mockResolvedValue([mockProduct]);
      prisma.product.count.mockResolvedValue(1);

      await service.findAll({});

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: { category: true },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a product by id', async () => {
      prisma.product.findUnique.mockResolvedValue(mockProduct);

      const result = await service.findOne('prod-1');

      expect(result).toEqual(mockProduct);
    });

    it('should throw NotFoundException if product not found', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    const updateDto = { name: '更新后的商品' };

    it('should update a product successfully', async () => {
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      prisma.product.update.mockResolvedValue({
        ...mockProduct,
        name: '更新后的商品',
      });

      const result = await service.update('prod-1', updateDto, 'admin');

      expect(result.name).toBe('更新后的商品');
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'Product',
          action: 'UPDATE',
          before: JSON.stringify(mockProduct),
          operator: 'admin',
        }),
      );
    });

    it('should throw NotFoundException if product not found', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(service.update('nonexistent', updateDto, 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should check unique skuCode on update', async () => {
      prisma.product.findUnique
        .mockResolvedValueOnce(mockProduct) // find existing
        .mockResolvedValueOnce({ ...mockProduct, id: 'other-prod' }); // conflict check (different skuCode)

      await expect(
        service.update('prod-1', { skuCode: 'SKU-002' }, 'admin'),
      ).rejects.toThrow(ConflictException);
    });

    it('should check unique barcode on update', async () => {
      prisma.product.findUnique
        .mockResolvedValueOnce(mockProduct) // find existing
        .mockResolvedValueOnce({ ...mockProduct, id: 'other-prod' }); // barcode conflict (only 2 calls since skuCode not changed)

      await expect(
        service.update('prod-1', { barcode: '6901234567899' }, 'admin'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('should delete a product successfully', async () => {
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      prisma.product.delete.mockResolvedValue(mockProduct);

      await service.remove('prod-1', 'admin');

      expect(prisma.product.delete).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
      });
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'Product',
          action: 'DELETE',
          operator: 'admin',
        }),
      );
    });

    it('should throw NotFoundException if product not found', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent', 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
