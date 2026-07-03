import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WarehousesController } from './warehouses.controller';
import { WarehousesService } from './warehouses.service';

describe('WarehousesController', () => {
  let controller: WarehousesController;
  let service: { [key: string]: ReturnType<typeof vi.fn> };

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
    service = {
      createWarehouse: vi.fn(),
      findAllWarehouses: vi.fn(),
      findOneWarehouse: vi.fn(),
      updateWarehouse: vi.fn(),
      removeWarehouse: vi.fn(),
      createZone: vi.fn(),
      findAllZones: vi.fn(),
      findOneZone: vi.fn(),
      updateZone: vi.fn(),
      removeZone: vi.fn(),
      createLocation: vi.fn(),
      findAllLocations: vi.fn(),
      findOneLocation: vi.fn(),
      updateLocation: vi.fn(),
      removeLocation: vi.fn(),
    };

    controller = new WarehousesController(service as unknown as WarehousesService);
  });

  // -------------------------------------------------------------------------
  // Warehouse
  // -------------------------------------------------------------------------

  describe('createWarehouse', () => {
    it('should delegate to service.createWarehouse with operator from request', async () => {
      const dto = { code: 'WH-001', name: '测试仓库' };
      const req = { user: { username: 'admin' } };

      service.createWarehouse.mockResolvedValue(mockWarehouse);

      const result = await controller.createWarehouse(dto, req);

      expect(result).toEqual(mockWarehouse);
      expect(service.createWarehouse).toHaveBeenCalledWith(dto, 'admin');
    });

    it('should use "system" when no user in request', async () => {
      const dto = { code: 'WH-002', name: '仓库2' };
      const req = {};

      service.createWarehouse.mockResolvedValue(mockWarehouse);

      await controller.createWarehouse(dto, req as { user?: { username: string } });

      expect(service.createWarehouse).toHaveBeenCalledWith(dto, 'system');
    });
  });

  describe('findAllWarehouses', () => {
    it('should delegate to service.findAllWarehouses with query', async () => {
      const query = { page: 1, limit: 10, name: '测试' };
      const paginatedResult = {
        items: [mockWarehouse],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      };

      service.findAllWarehouses.mockResolvedValue(paginatedResult);

      const result = await controller.findAllWarehouses(query);

      expect(result).toEqual(paginatedResult);
      expect(service.findAllWarehouses).toHaveBeenCalledWith(query);
    });
  });

  describe('findOneWarehouse', () => {
    it('should delegate to service.findOneWarehouse with id', async () => {
      service.findOneWarehouse.mockResolvedValue(mockWarehouse);

      const result = await controller.findOneWarehouse('wh-1');

      expect(result).toEqual(mockWarehouse);
      expect(service.findOneWarehouse).toHaveBeenCalledWith('wh-1');
    });
  });

  describe('updateWarehouse', () => {
    it('should delegate to service.updateWarehouse with id, dto, and operator', async () => {
      const dto = { name: '更新仓库' };
      const req = { user: { username: 'operator1' } };

      service.updateWarehouse.mockResolvedValue({ ...mockWarehouse, name: '更新仓库' });

      const result = await controller.updateWarehouse('wh-1', dto, req);

      expect(result.name).toBe('更新仓库');
      expect(service.updateWarehouse).toHaveBeenCalledWith('wh-1', dto, 'operator1');
    });
  });

  describe('removeWarehouse', () => {
    it('should delegate to service.removeWarehouse with id and operator', async () => {
      const req = { user: { username: 'admin' } };

      service.removeWarehouse.mockResolvedValue(undefined);

      await controller.removeWarehouse('wh-1', req);

      expect(service.removeWarehouse).toHaveBeenCalledWith('wh-1', 'admin');
    });

    it('should return no content on successful delete', async () => {
      const req = { user: { username: 'admin' } };

      service.removeWarehouse.mockResolvedValue(undefined);

      const result = await controller.removeWarehouse('wh-1', req);

      expect(result).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Zone
  // -------------------------------------------------------------------------

  describe('createZone', () => {
    it('should delegate to service.createZone with warehouseId from param', async () => {
      const dto = { code: 'ZONE-A', name: 'A区' } as any;
      const req = { user: { username: 'admin' } };

      service.createZone.mockResolvedValue(mockZone);

      const result = await controller.createZone('wh-1', dto, req);

      expect(result).toEqual(mockZone);
      expect(dto.warehouseId).toBe('wh-1');
      expect(service.createZone).toHaveBeenCalledWith(dto, 'admin');
    });
  });

  describe('findAllZones', () => {
    it('should delegate to service.findAllZones with warehouseId in query', async () => {
      const query = { page: 1, limit: 10 } as any;

      service.findAllZones.mockResolvedValue({ items: [mockZone], total: 1, page: 1, limit: 10, totalPages: 1 });

      await controller.findAllZones('wh-1', query);

      expect(query.warehouseId).toBe('wh-1');
      expect(service.findAllZones).toHaveBeenCalledWith(query);
    });
  });

  describe('findOneZone', () => {
    it('should delegate to service.findOneZone with id', async () => {
      service.findOneZone.mockResolvedValue(mockZone);

      const result = await controller.findOneZone('zone-1');

      expect(result).toEqual(mockZone);
      expect(service.findOneZone).toHaveBeenCalledWith('zone-1');
    });
  });

  describe('updateZone', () => {
    it('should delegate to service.updateZone with id, dto, and operator', async () => {
      const dto = { name: '更新区' };
      const req = { user: { username: 'operator1' } };

      service.updateZone.mockResolvedValue({ ...mockZone, name: '更新区' });

      const result = await controller.updateZone('wh-1', 'zone-1', dto, req);

      expect(result.name).toBe('更新区');
      expect(service.updateZone).toHaveBeenCalledWith('zone-1', dto, 'operator1');
    });
  });

  describe('removeZone', () => {
    it('should delegate to service.removeZone with id and operator', async () => {
      const req = { user: { username: 'admin' } };

      service.removeZone.mockResolvedValue(undefined);

      await controller.removeZone('zone-1', req);

      expect(service.removeZone).toHaveBeenCalledWith('zone-1', 'admin');
    });
  });

  // -------------------------------------------------------------------------
  // Location
  // -------------------------------------------------------------------------

  describe('createLocation', () => {
    it('should delegate to service.createLocation with zoneId from param', async () => {
      const dto = { code: 'A-01-01' } as any;
      const req = { user: { username: 'admin' } };

      service.createLocation.mockResolvedValue(mockLocation);

      const result = await controller.createLocation('zone-1', dto, req);

      expect(result).toEqual(mockLocation);
      expect(dto.zoneId).toBe('zone-1');
      expect(service.createLocation).toHaveBeenCalledWith(dto, 'admin');
    });
  });

  describe('findAllLocations', () => {
    it('should delegate to service.findAllLocations with zoneId in query', async () => {
      const query = { page: 1, limit: 10 } as any;

      service.findAllLocations.mockResolvedValue({ items: [mockLocation], total: 1, page: 1, limit: 10, totalPages: 1 });

      await controller.findAllLocations('zone-1', query);

      expect(query.zoneId).toBe('zone-1');
      expect(service.findAllLocations).toHaveBeenCalledWith(query);
    });
  });

  describe('findOneLocation', () => {
    it('should delegate to service.findOneLocation with id', async () => {
      service.findOneLocation.mockResolvedValue(mockLocation);

      const result = await controller.findOneLocation('loc-1');

      expect(result).toEqual(mockLocation);
      expect(service.findOneLocation).toHaveBeenCalledWith('loc-1');
    });
  });

  describe('updateLocation', () => {
    it('should delegate to service.updateLocation with id, dto, and operator', async () => {
      const dto = { status: 'INACTIVE' };
      const req = { user: { username: 'operator1' } };

      service.updateLocation.mockResolvedValue({ ...mockLocation, status: 'INACTIVE' });

      const result = await controller.updateLocation('zone-1', 'loc-1', dto, req);

      expect(result.status).toBe('INACTIVE');
      expect(service.updateLocation).toHaveBeenCalledWith('loc-1', dto, 'operator1');
    });
  });

  describe('removeLocation', () => {
    it('should delegate to service.removeLocation with id and operator', async () => {
      const req = { user: { username: 'admin' } };

      service.removeLocation.mockResolvedValue(undefined);

      await controller.removeLocation('loc-1', req);

      expect(service.removeLocation).toHaveBeenCalledWith('loc-1', 'admin');
    });
  });
});
