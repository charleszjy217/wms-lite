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
import { BatchesService } from './batches.service';
import { CreateBatchDto } from './dto/create-batch.dto';
import { UpdateBatchDto } from './dto/update-batch.dto';
import { QueryBatchDto } from './dto/query-batch.dto';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('batches')
export class BatchesController {
  constructor(private readonly batchesService: BatchesService) {}

  @Post()
  @Roles('admin', 'operator')
  async create(@Body() dto: CreateBatchDto, @Request() req: { user?: { username: string } }) {
    const operator = req.user?.username ?? 'system';
    return this.batchesService.create(dto, operator);
  }

  @Get()
  async findAll(@Query() query: QueryBatchDto) {
    return this.batchesService.findAll(query);
  }

  @Get('expiring')
  async findExpiring(@Query('days') days?: string) {
    const d = days ? parseInt(days, 10) : 30;
    return this.batchesService.findExpiring(d);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.batchesService.findOne(id);
  }

  @Patch(':id')
  @Roles('admin', 'operator')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateBatchDto,
    @Request() req: { user?: { username: string } },
  ) {
    const operator = req.user?.username ?? 'system';
    return this.batchesService.update(id, dto, operator);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @Request() req: { user?: { username: string } }) {
    const operator = req.user?.username ?? 'system';
    await this.batchesService.remove(id, operator);
  }

  @Post(':id/validate-outbound')
  @Roles('admin', 'operator')
  async validateOutbound(@Param('id') id: string) {
    await this.batchesService.validateBatchNotExpired(id);
    return { valid: true, message: '批次可用于出库' };
  }
}
