import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { QueryWarehouseDto } from './dto/query-warehouse.dto';
import { CreateZoneDto } from './dto/create-zone.dto';
import { UpdateZoneDto } from './dto/update-zone.dto';
import { QueryZoneDto } from './dto/query-zone.dto';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { QueryLocationDto } from './dto/query-location.dto';

@Injectable()
export class WarehousesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // ---------------------------------------------------------------------------
  // Warehouse
  // ---------------------------------------------------------------------------

  async createWarehouse(dto: CreateWarehouseDto, operator: string) {
    const existing = await this.prisma.warehouse.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException('仓库编码已存在');
    }

    const warehouse = await this.prisma.warehouse.create({
      data: {
        code: dto.code,
        name: dto.name,
        address: dto.address ?? null,
        type: dto.type ?? 'PHYSICAL',
        status: dto.status ?? 'ACTIVE',
      },
    });

    await this.auditService.log({
      entityType: 'Warehouse',
      entityId: warehouse.id,
      action: 'CREATE',
      before: null,
      after: JSON.stringify(warehouse),
      operator,
      reason: null,
    });

    return warehouse;
  }

  async findAllWarehouses(query: QueryWarehouseDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.WarehouseWhereInput = {};
    if (query.name) {
      where.name = { contains: query.name, mode: 'insensitive' };
    }
    if (query.code) {
      where.code = { contains: query.code, mode: 'insensitive' };
    }
    if (query.status) {
      where.status = query.status;
    }

    const [items, total] = await Promise.all([
      this.prisma.warehouse.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { zones: { include: { locations: true } } },
      }),
      this.prisma.warehouse.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOneWarehouse(id: string) {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id },
      include: { zones: { include: { locations: true } } },
    });

    if (!warehouse) {
      throw new NotFoundException('仓库不存在');
    }

    return warehouse;
  }

  async updateWarehouse(id: string, dto: UpdateWarehouseDto, operator: string) {
    const existing = await this.prisma.warehouse.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('仓库不存在');
    }

    if (dto.code && dto.code !== existing.code) {
      const conflict = await this.prisma.warehouse.findUnique({
        where: { code: dto.code },
      });
      if (conflict) {
        throw new ConflictException('仓库编码已存在');
      }
    }

    const before = JSON.stringify(existing);

    const data: Prisma.WarehouseUncheckedUpdateInput = {};
    if (dto.code !== undefined) data.code = dto.code;
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.address !== undefined) data.address = dto.address;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.status !== undefined) data.status = dto.status;

    const warehouse = await this.prisma.warehouse.update({
      where: { id },
      data,
    });

    await this.auditService.log({
      entityType: 'Warehouse',
      entityId: warehouse.id,
      action: 'UPDATE',
      before,
      after: JSON.stringify(warehouse),
      operator,
      reason: null,
    });

    return warehouse;
  }

  async removeWarehouse(id: string, operator: string) {
    const existing = await this.prisma.warehouse.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('仓库不存在');
    }

    const before = JSON.stringify(existing);

    await this.prisma.warehouse.delete({
      where: { id },
    });

    await this.auditService.log({
      entityType: 'Warehouse',
      entityId: id,
      action: 'DELETE',
      before,
      after: null,
      operator,
      reason: null,
    });
  }

  // ---------------------------------------------------------------------------
  // Zone
  // ---------------------------------------------------------------------------

  async createZone(dto: CreateZoneDto, operator: string) {
    // Verify warehouse exists
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id: dto.warehouseId },
    });
    if (!warehouse) {
      throw new NotFoundException('所属仓库不存在');
    }

    // Check unique code within warehouse
    const existing = await this.prisma.zone.findUnique({
      where: { code_warehouseId: { code: dto.code, warehouseId: dto.warehouseId } },
    });
    if (existing) {
      throw new ConflictException('该仓库下库区编码已存在');
    }

    const zone = await this.prisma.zone.create({
      data: {
        code: dto.code,
        name: dto.name,
        warehouseId: dto.warehouseId,
        status: dto.status ?? 'ACTIVE',
      },
    });

    await this.auditService.log({
      entityType: 'Zone',
      entityId: zone.id,
      action: 'CREATE',
      before: null,
      after: JSON.stringify(zone),
      operator,
      reason: null,
    });

    return zone;
  }

  async findAllZones(query: QueryZoneDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ZoneWhereInput = {};
    if (query.name) {
      where.name = { contains: query.name, mode: 'insensitive' };
    }
    if (query.code) {
      where.code = { contains: query.code, mode: 'insensitive' };
    }
    if (query.warehouseId) {
      where.warehouseId = query.warehouseId;
    }
    if (query.status) {
      where.status = query.status;
    }

    const [items, total] = await Promise.all([
      this.prisma.zone.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { warehouse: true, locations: true },
      }),
      this.prisma.zone.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOneZone(id: string) {
    const zone = await this.prisma.zone.findUnique({
      where: { id },
      include: { warehouse: true, locations: true },
    });

    if (!zone) {
      throw new NotFoundException('库区不存在');
    }

    return zone;
  }

  async updateZone(id: string, dto: UpdateZoneDto, operator: string) {
    const existing = await this.prisma.zone.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('库区不存在');
    }

    // If warehouseId is being changed, verify new warehouse exists
    if (dto.warehouseId && dto.warehouseId !== existing.warehouseId) {
      const warehouse = await this.prisma.warehouse.findUnique({
        where: { id: dto.warehouseId },
      });
      if (!warehouse) {
        throw new NotFoundException('所属仓库不存在');
      }
    }

    // Check unique code within warehouse if code or warehouseId changes
    const targetWarehouseId = dto.warehouseId ?? existing.warehouseId;
    if (dto.code && dto.code !== existing.code) {
      const conflict = await this.prisma.zone.findUnique({
        where: {
          code_warehouseId: { code: dto.code, warehouseId: targetWarehouseId },
        },
      });
      if (conflict) {
        throw new ConflictException('该仓库下库区编码已存在');
      }
    }

    const before = JSON.stringify(existing);

    const data: Prisma.ZoneUncheckedUpdateInput = {};
    if (dto.code !== undefined) data.code = dto.code;
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.warehouseId !== undefined) data.warehouseId = dto.warehouseId;
    if (dto.status !== undefined) data.status = dto.status;

    const zone = await this.prisma.zone.update({
      where: { id },
      data,
    });

    await this.auditService.log({
      entityType: 'Zone',
      entityId: zone.id,
      action: 'UPDATE',
      before,
      after: JSON.stringify(zone),
      operator,
      reason: null,
    });

    return zone;
  }

  async removeZone(id: string, operator: string) {
    const existing = await this.prisma.zone.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('库区不存在');
    }

    const before = JSON.stringify(existing);

    await this.prisma.zone.delete({
      where: { id },
    });

    await this.auditService.log({
      entityType: 'Zone',
      entityId: id,
      action: 'DELETE',
      before,
      after: null,
      operator,
      reason: null,
    });
  }

  // ---------------------------------------------------------------------------
  // Location
  // ---------------------------------------------------------------------------

  async createLocation(dto: CreateLocationDto, operator: string) {
    // Verify zone exists
    const zone = await this.prisma.zone.findUnique({
      where: { id: dto.zoneId },
    });
    if (!zone) {
      throw new NotFoundException('所属库区不存在');
    }

    // Check unique code within zone
    const existing = await this.prisma.location.findUnique({
      where: { code_zoneId: { code: dto.code, zoneId: dto.zoneId } },
    });
    if (existing) {
      throw new ConflictException('该库区下货位编号已存在');
    }

    const location = await this.prisma.location.create({
      data: {
        code: dto.code,
        warehouseId: zone.warehouseId,
        area: '',
        aisle: '',
        rack: '',
        level: '',
        position: '',
        zoneId: dto.zoneId,
        barcode: dto.barcode ?? null,
        status: dto.status ?? 'ACTIVE',
        maxCapacity: dto.maxCapacity ?? null,
      },
    });

    await this.auditService.log({
      entityType: 'Location',
      entityId: location.id,
      action: 'CREATE',
      before: null,
      after: JSON.stringify(location),
      operator,
      reason: null,
    });

    return location;
  }

  async findAllLocations(query: QueryLocationDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.LocationWhereInput = {};
    if (query.code) {
      where.code = { contains: query.code, mode: 'insensitive' };
    }
    if (query.zoneId) {
      where.zoneId = query.zoneId;
    }
    if (query.status) {
      where.status = query.status;
    }

    const [items, total] = await Promise.all([
      this.prisma.location.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { zone: { include: { warehouse: true } } },
      }),
      this.prisma.location.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOneLocation(id: string) {
    const location = await this.prisma.location.findUnique({
      where: { id },
      include: { zone: { include: { warehouse: true } } },
    });

    if (!location) {
      throw new NotFoundException('货位不存在');
    }

    return location;
  }

  async updateLocation(id: string, dto: UpdateLocationDto, operator: string) {
    const existing = await this.prisma.location.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('货位不存在');
    }

    // If zoneId is being changed, verify new zone exists
    if (dto.zoneId && dto.zoneId !== existing.zoneId) {
      const zone = await this.prisma.zone.findUnique({
        where: { id: dto.zoneId },
      });
      if (!zone) {
        throw new NotFoundException('所属库区不存在');
      }
    }

    // Check unique code within zone if code or zoneId changes
    const targetZoneId = dto.zoneId ?? existing.zoneId;
    if (dto.code && dto.code !== existing.code && targetZoneId) {
      const conflict = await this.prisma.location.findUnique({
        where: {
          code_zoneId: { code: dto.code, zoneId: targetZoneId },
        },
      });
      if (conflict) {
        throw new ConflictException('该库区下货位编号已存在');
      }
    }

    const before = JSON.stringify(existing);

    const data: Prisma.LocationUncheckedUpdateInput = {};
    if (dto.code !== undefined) data.code = dto.code;
    if (dto.zoneId !== undefined) data.zoneId = dto.zoneId;
    if (dto.barcode !== undefined) data.barcode = dto.barcode;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.maxCapacity !== undefined) data.maxCapacity = dto.maxCapacity;

    const location = await this.prisma.location.update({
      where: { id },
      data,
    });

    await this.auditService.log({
      entityType: 'Location',
      entityId: location.id,
      action: 'UPDATE',
      before,
      after: JSON.stringify(location),
      operator,
      reason: null,
    });

    return location;
  }

  async removeLocation(id: string, operator: string) {
    const existing = await this.prisma.location.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('货位不存在');
    }

    const before = JSON.stringify(existing);

    await this.prisma.location.delete({
      where: { id },
    });

    await this.auditService.log({
      entityType: 'Location',
      entityId: id,
      action: 'DELETE',
      before,
      after: null,
      operator,
      reason: null,
    });
  }
}
