import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { WarehousesService } from './warehouses.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { QueryWarehouseDto } from './dto/query-warehouse.dto';
import { CreateZoneDto } from './dto/create-zone.dto';
import { UpdateZoneDto } from './dto/update-zone.dto';
import { QueryZoneDto } from './dto/query-zone.dto';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { QueryLocationDto } from './dto/query-location.dto';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('warehouses')
export class WarehousesController {
  constructor(private readonly warehousesService: WarehousesService) {}

  // ---------------------------------------------------------------------------
  // Warehouse
  // ---------------------------------------------------------------------------

  @Post()
  @Roles('admin', 'operator')
  async createWarehouse(
    @Body() dto: CreateWarehouseDto,
    @Request() req: { user?: { username: string } },
  ) {
    const operator = req.user?.username ?? 'system';
    return this.warehousesService.createWarehouse(dto, operator);
  }

  @Get()
  async findAllWarehouses(@Query() query: QueryWarehouseDto) {
    return this.warehousesService.findAllWarehouses(query);
  }

  @Get(':id')
  async findOneWarehouse(@Param('id') id: string) {
    return this.warehousesService.findOneWarehouse(id);
  }

  @Patch(':id')
  @Roles('admin', 'operator')
  async updateWarehouse(
    @Param('id') id: string,
    @Body() dto: UpdateWarehouseDto,
    @Request() req: { user?: { username: string } },
  ) {
    const operator = req.user?.username ?? 'system';
    return this.warehousesService.updateWarehouse(id, dto, operator);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeWarehouse(
    @Param('id') id: string,
    @Request() req: { user?: { username: string } },
  ) {
    const operator = req.user?.username ?? 'system';
    await this.warehousesService.removeWarehouse(id, operator);
  }

  // ---------------------------------------------------------------------------
  // Zone (nested under warehouse)
  // ---------------------------------------------------------------------------

  @Post(':warehouseId/zones')
  @Roles('admin', 'operator')
  async createZone(
    @Param('warehouseId') warehouseId: string,
    @Body() dto: CreateZoneDto,
    @Request() req: { user?: { username: string } },
  ) {
    const operator = req.user?.username ?? 'system';
    dto.warehouseId = warehouseId;
    return this.warehousesService.createZone(dto, operator);
  }

  @Get(':warehouseId/zones')
  async findAllZones(
    @Param('warehouseId') warehouseId: string,
    @Query() query: QueryZoneDto,
  ) {
    query.warehouseId = warehouseId;
    return this.warehousesService.findAllZones(query);
  }

  @Get(':warehouseId/zones/:id')
  async findOneZone(@Param('id') id: string) {
    return this.warehousesService.findOneZone(id);
  }

  @Patch(':warehouseId/zones/:id')
  @Roles('admin', 'operator')
  async updateZone(
    @Param('warehouseId') _warehouseId: string,
    @Param('id') id: string,
    @Body() dto: UpdateZoneDto,
    @Request() req: { user?: { username: string } },
  ) {
    const operator = req.user?.username ?? 'system';
    return this.warehousesService.updateZone(id, dto, operator);
  }

  @Delete(':warehouseId/zones/:id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeZone(
    @Param('id') id: string,
    @Request() req: { user?: { username: string } },
  ) {
    const operator = req.user?.username ?? 'system';
    await this.warehousesService.removeZone(id, operator);
  }

  // ---------------------------------------------------------------------------
  // Location (nested under zone)
  // ---------------------------------------------------------------------------

  @Post(':warehouseId/zones/:zoneId/locations')
  @Roles('admin', 'operator')
  async createLocation(
    @Param('zoneId') zoneId: string,
    @Body() dto: CreateLocationDto,
    @Request() req: { user?: { username: string } },
  ) {
    const operator = req.user?.username ?? 'system';
    dto.zoneId = zoneId;
    return this.warehousesService.createLocation(dto, operator);
  }

  @Get(':warehouseId/zones/:zoneId/locations')
  async findAllLocations(
    @Param('zoneId') zoneId: string,
    @Query() query: QueryLocationDto,
  ) {
    query.zoneId = zoneId;
    return this.warehousesService.findAllLocations(query);
  }

  @Get(':warehouseId/zones/:zoneId/locations/:id')
  async findOneLocation(@Param('id') id: string) {
    return this.warehousesService.findOneLocation(id);
  }

  @Patch(':warehouseId/zones/:zoneId/locations/:id')
  @Roles('admin', 'operator')
  async updateLocation(
    @Param('zoneId') _zoneId: string,
    @Param('id') id: string,
    @Body() dto: UpdateLocationDto,
    @Request() req: { user?: { username: string } },
  ) {
    const operator = req.user?.username ?? 'system';
    return this.warehousesService.updateLocation(id, dto, operator);
  }

  @Delete(':warehouseId/zones/:zoneId/locations/:id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeLocation(
    @Param('id') id: string,
    @Request() req: { user?: { username: string } },
  ) {
    const operator = req.user?.username ?? 'system';
    await this.warehousesService.removeLocation(id, operator);
  }
}
