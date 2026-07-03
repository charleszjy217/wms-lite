import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { WarehousesService } from './warehouses.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

type MockPrisma = {
  warehouse: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  zone: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  location: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
};

describe('WarehousesService', () => {
  let service: WarehousesService;
  let prisma: MockPrisma;
  let auditService: { log: ReturnType<typeof vi.fn> };

  const mockWarehouse = {
    id: 'wh-1',
    code: 'WH-001',
    name: '测试仓库',
    type: 'PHYSICAL',
    address: '测试地址',
    status: 'ACTIVE',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockZone = {
    id: 'zone-1',
    code: 'ZONE-A',
    name: 'A区',
    warehouseId: 'wh-1',
    status: 'ACTIVE',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockLocation = {
    id: 'loc-1',
    code: 'A-01-01',
    zoneId: 'zone-1',
    barcode: 'BC-001',
    status: 'ACTIVE',
    maxCapacity: 1000,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  beforeEach(() => {
    prisma = {
      warehouse: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      zone: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      location: {
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

    service = new WarehousesService(
      prisma as unknown as PrismaService,
      auditService as unknown as AuditService,
    );
  });

  // ===========================================================================
  // Warehouse
  // ===========================================================================

  describe('createWarehouse', () => {
    const createDto = { code: 'WH-001', name: '测试仓库', address: '测试地址' };

    it('should create a warehouse successfully', async () => {
      prisma.warehouse.findUnique.mockResolvedValue(null);
      prisma.warehouse.create.mockResolvedValue(mockWarehouse);

      const result = await service.createWarehouse(createDto, 'admin');

      expect(result).toEqual(mockWarehouse);
      expect(prisma.warehouse.create).toHaveBeenCalledOnce();
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'Warehouse',
          action: 'CREATE',
          operator: 'admin',
        }),
      );
    });

    it('should throw ConflictException if code exists', async () => {
      prisma.warehouse.findUnique.mockResolvedValue(mockWarehouse);

      await expect(service.createWarehouse(createDto, 'admin')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should create warehouse without optional fields', async () => {
      const minimalDto = { code: 'WH-002', name: '简约仓库' };

      prisma.warehouse.findUnique.mockResolvedValue(null);
      prisma.warehouse.create.mockResolvedValue({
        ...mockWarehouse,
        id: 'wh-2',
        code: 'WH-002',
        name: '简约仓库',
        address: null,
      });

      const result = await service.createWarehouse(minimalDto, 'operator1');

      expect(result.code).toBe('WH-002');
      expect(auditService.log).toHaveBeenCalledOnce();
    });
  });

  describe('findAllWarehouses', () => {
    it('should return paginated warehouses', async () => {
      prisma.warehouse.findMany.mockResolvedValue([mockWarehouse]);
      prisma.warehouse.count.mockResolvedValue(1);

      const result = await service.findAllWarehouses({ page: 1, limit: 20 });

      expect(result.items).toEqual([mockWarehouse]);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it('should filter by name', async () => {
      prisma.warehouse.findMany.mockResolvedValue([mockWarehouse]);
      prisma.warehouse.count.mockResolvedValue(1);

      await service.findAllWarehouses({ name: '测试' });

      expect(prisma.warehouse.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            name: { contains: '测试', mode: 'insensitive' },
          }),
        }),
      );
    });

    it('should filter by code', async () => {
      prisma.warehouse.findMany.mockResolvedValue([mockWarehouse]);
      prisma.warehouse.count.mockResolvedValue(1);

      await service.findAllWarehouses({ code: 'WH-001' });

      expect(prisma.warehouse.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            code: { contains: 'WH-001', mode: 'insensitive' },
          }),
        }),
      );
    });

    it('should filter by status', async () => {
      prisma.warehouse.findMany.mockResolvedValue([mockWarehouse]);
      prisma.warehouse.count.mockResolvedValue(1);

      await service.findAllWarehouses({ status: 'ACTIVE' });

      expect(prisma.warehouse.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'ACTIVE',
          }),
        }),
      );
    });

    it('should return empty list when no warehouses match', async () => {
      prisma.warehouse.findMany.mockResolvedValue([]);
      prisma.warehouse.count.mockResolvedValue(0);

      const result = await service.findAllWarehouses({ name: 'nonexistent' });

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });

    it('should apply default pagination when not specified', async () => {
      prisma.warehouse.findMany.mockResolvedValue([]);
      prisma.warehouse.count.mockResolvedValue(0);

      await service.findAllWarehouses({});

      expect(prisma.warehouse.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
        }),
      );
    });

    it('should include zones and locations', async () => {
      prisma.warehouse.findMany.mockResolvedValue([mockWarehouse]);
      prisma.warehouse.count.mockResolvedValue(1);

      await service.findAllWarehouses({});

      expect(prisma.warehouse.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: { zones: { include: { locations: true } } },
        }),
      );
    });
  });

  describe('findOneWarehouse', () => {
    it('should return a warehouse by id', async () => {
      prisma.warehouse.findUnique.mockResolvedValue(mockWarehouse);

      const result = await service.findOneWarehouse('wh-1');

      expect(result).toEqual(mockWarehouse);
    });

    it('should throw NotFoundException if warehouse not found', async () => {
      prisma.warehouse.findUnique.mockResolvedValue(null);

      await expect(service.findOneWarehouse('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateWarehouse', () => {
    const updateDto = { name: '更新后的仓库' };

    it('should update a warehouse successfully', async () => {
      prisma.warehouse.findUnique.mockResolvedValue(mockWarehouse);
      prisma.warehouse.update.mockResolvedValue({
        ...mockWarehouse,
        name: '更新后的仓库',
      });

      const result = await service.updateWarehouse('wh-1', updateDto, 'admin');

      expect(result.name).toBe('更新后的仓库');
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'Warehouse',
          action: 'UPDATE',
          before: JSON.stringify(mockWarehouse),
          operator: 'admin',
        }),
      );
    });

    it('should throw NotFoundException if warehouse not found', async () => {
      prisma.warehouse.findUnique.mockResolvedValue(null);

      await expect(
        service.updateWarehouse('nonexistent', updateDto, 'admin'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should check unique code on update', async () => {
      prisma.warehouse.findUnique
        .mockResolvedValueOnce(mockWarehouse)
        .mockResolvedValueOnce({ ...mockWarehouse, id: 'other-wh' });

      await expect(
        service.updateWarehouse('wh-1', { code: 'WH-002' }, 'admin'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('removeWarehouse', () => {
    it('should delete a warehouse successfully', async () => {
      prisma.warehouse.findUnique.mockResolvedValue(mockWarehouse);
      prisma.warehouse.delete.mockResolvedValue(mockWarehouse);

      await service.removeWarehouse('wh-1', 'admin');

      expect(prisma.warehouse.delete).toHaveBeenCalledWith({
        where: { id: 'wh-1' },
      });
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'Warehouse',
          action: 'DELETE',
          operator: 'admin',
        }),
      );
    });

    it('should throw NotFoundException if warehouse not found', async () => {
      prisma.warehouse.findUnique.mockResolvedValue(null);

      await expect(service.removeWarehouse('nonexistent', 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ===========================================================================
  // Zone
  // ===========================================================================

  describe('createZone', () => {
    const createDto = { code: 'ZONE-A', name: 'A区', warehouseId: 'wh-1' };

    it('should create a zone successfully', async () => {
      prisma.warehouse.findUnique.mockResolvedValue(mockWarehouse);
      prisma.zone.findUnique.mockResolvedValue(null);
      prisma.zone.create.mockResolvedValue(mockZone);

      const result = await service.createZone(createDto, 'admin');

      expect(result).toEqual(mockZone);
      expect(prisma.zone.create).toHaveBeenCalledOnce();
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'Zone',
          action: 'CREATE',
          operator: 'admin',
        }),
      );
    });

    it('should throw NotFoundException if warehouse does not exist', async () => {
      prisma.warehouse.findUnique.mockResolvedValue(null);

      await expect(service.createZone(createDto, 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException if code exists within warehouse', async () => {
      prisma.warehouse.findUnique.mockResolvedValue(mockWarehouse);
      prisma.zone.findUnique.mockResolvedValue(mockZone);

      await expect(service.createZone(createDto, 'admin')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findAllZones', () => {
    it('should return paginated zones', async () => {
      prisma.zone.findMany.mockResolvedValue([mockZone]);
      prisma.zone.count.mockResolvedValue(1);

      const result = await service.findAllZones({ page: 1, limit: 20 });

      expect(result.items).toEqual([mockZone]);
      expect(result.total).toBe(1);
    });

    it('should filter by warehouseId', async () => {
      prisma.zone.findMany.mockResolvedValue([mockZone]);
      prisma.zone.count.mockResolvedValue(1);

      await service.findAllZones({ warehouseId: 'wh-1' });

      expect(prisma.zone.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            warehouseId: 'wh-1',
          }),
        }),
      );
    });

    it('should include warehouse and locations', async () => {
      prisma.zone.findMany.mockResolvedValue([mockZone]);
      prisma.zone.count.mockResolvedValue(1);

      await service.findAllZones({});

      expect(prisma.zone.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: { warehouse: true, locations: true },
        }),
      );
    });
  });

  describe('findOneZone', () => {
    it('should return a zone by id', async () => {
      prisma.zone.findUnique.mockResolvedValue(mockZone);

      const result = await service.findOneZone('zone-1');

      expect(result).toEqual(mockZone);
    });

    it('should throw NotFoundException if zone not found', async () => {
      prisma.zone.findUnique.mockResolvedValue(null);

      await expect(service.findOneZone('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateZone', () => {
    const updateDto = { name: '更新后的区' };

    it('should update a zone successfully', async () => {
      prisma.zone.findUnique.mockResolvedValue(mockZone);
      prisma.zone.update.mockResolvedValue({
        ...mockZone,
        name: '更新后的区',
      });

      const result = await service.updateZone('zone-1', updateDto, 'admin');

      expect(result.name).toBe('更新后的区');
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'Zone',
          action: 'UPDATE',
          operator: 'admin',
        }),
      );
    });

    it('should throw NotFoundException if zone not found', async () => {
      prisma.zone.findUnique.mockResolvedValue(null);

      await expect(
        service.updateZone('nonexistent', updateDto, 'admin'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should verify new warehouse exists when warehouseId changes', async () => {
      prisma.zone.findUnique.mockResolvedValue(mockZone);
      prisma.warehouse.findUnique.mockResolvedValue(null);

      await expect(
        service.updateZone('zone-1', { warehouseId: 'nonexistent-wh' }, 'admin'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeZone', () => {
    it('should delete a zone successfully', async () => {
      prisma.zone.findUnique.mockResolvedValue(mockZone);
      prisma.zone.delete.mockResolvedValue(mockZone);

      await service.removeZone('zone-1', 'admin');

      expect(prisma.zone.delete).toHaveBeenCalledWith({
        where: { id: 'zone-1' },
      });
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'Zone',
          action: 'DELETE',
          operator: 'admin',
        }),
      );
    });

    it('should throw NotFoundException if zone not found', async () => {
      prisma.zone.findUnique.mockResolvedValue(null);

      await expect(service.removeZone('nonexistent', 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ===========================================================================
  // Location
  // ===========================================================================

  describe('createLocation', () => {
    const createDto = { code: 'A-01-01', zoneId: 'zone-1', maxCapacity: 1000 };

    it('should create a location successfully', async () => {
      prisma.zone.findUnique.mockResolvedValue(mockZone);
      prisma.location.findUnique.mockResolvedValue(null);
      prisma.location.create.mockResolvedValue(mockLocation);

      const result = await service.createLocation(createDto, 'admin');

      expect(result).toEqual(mockLocation);
      expect(prisma.location.create).toHaveBeenCalledOnce();
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'Location',
          action: 'CREATE',
          operator: 'admin',
        }),
      );
    });

    it('should throw NotFoundException if zone does not exist', async () => {
      prisma.zone.findUnique.mockResolvedValue(null);

      await expect(service.createLocation(createDto, 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException if code exists within zone', async () => {
      prisma.zone.findUnique.mockResolvedValue(mockZone);
      prisma.location.findUnique.mockResolvedValue(mockLocation);

      await expect(service.createLocation(createDto, 'admin')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findAllLocations', () => {
    it('should return paginated locations', async () => {
      prisma.location.findMany.mockResolvedValue([mockLocation]);
      prisma.location.count.mockResolvedValue(1);

      const result = await service.findAllLocations({ page: 1, limit: 20 });

      expect(result.items).toEqual([mockLocation]);
      expect(result.total).toBe(1);
    });

    it('should filter by zoneId', async () => {
      prisma.location.findMany.mockResolvedValue([mockLocation]);
      prisma.location.count.mockResolvedValue(1);

      await service.findAllLocations({ zoneId: 'zone-1' });

      expect(prisma.location.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            zoneId: 'zone-1',
          }),
        }),
      );
    });

    it('should include zone with warehouse', async () => {
      prisma.location.findMany.mockResolvedValue([mockLocation]);
      prisma.location.count.mockResolvedValue(1);

      await service.findAllLocations({});

      expect(prisma.location.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: { zone: { include: { warehouse: true } } },
        }),
      );
    });
  });

  describe('findOneLocation', () => {
    it('should return a location by id', async () => {
      prisma.location.findUnique.mockResolvedValue(mockLocation);

      const result = await service.findOneLocation('loc-1');

      expect(result).toEqual(mockLocation);
    });

    it('should throw NotFoundException if location not found', async () => {
      prisma.location.findUnique.mockResolvedValue(null);

      await expect(service.findOneLocation('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateLocation', () => {
    const updateDto = { status: 'INACTIVE' };

    it('should update a location successfully', async () => {
      prisma.location.findUnique.mockResolvedValue(mockLocation);
      prisma.location.update.mockResolvedValue({
        ...mockLocation,
        status: 'INACTIVE',
      });

      const result = await service.updateLocation('loc-1', updateDto, 'admin');

      expect(result.status).toBe('INACTIVE');
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'Location',
          action: 'UPDATE',
          operator: 'admin',
        }),
      );
    });

    it('should throw NotFoundException if location not found', async () => {
      prisma.location.findUnique.mockResolvedValue(null);

      await expect(
        service.updateLocation('nonexistent', updateDto, 'admin'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should verify new zone exists when zoneId changes', async () => {
      prisma.location.findUnique.mockResolvedValue(mockLocation);
      prisma.zone.findUnique.mockResolvedValue(null);

      await expect(
        service.updateLocation('loc-1', { zoneId: 'nonexistent-zone' }, 'admin'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeLocation', () => {
    it('should delete a location successfully', async () => {
      prisma.location.findUnique.mockResolvedValue(mockLocation);
      prisma.location.delete.mockResolvedValue(mockLocation);

      await service.removeLocation('loc-1', 'admin');

      expect(prisma.location.delete).toHaveBeenCalledWith({
        where: { id: 'loc-1' },
      });
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'Location',
          action: 'DELETE',
          operator: 'admin',
        }),
      );
    });

    it('should throw NotFoundException if location not found', async () => {
      prisma.location.findUnique.mockResolvedValue(null);

      await expect(service.removeLocation('nonexistent', 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
