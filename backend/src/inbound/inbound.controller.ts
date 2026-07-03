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
import { InboundService } from './inbound.service';
import { CreateReceivingOrderDto } from './dto/create-receiving-order.dto';
import { UpdateReceivingOrderDto } from './dto/update-receiving-order.dto';
import { QueryReceivingOrderDto } from './dto/query-receiving-order.dto';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('inbound/receiving-orders')
export class InboundController {
  constructor(private readonly inboundService: InboundService) {}

  @Post()
  @Roles('admin', 'operator')
  async create(
    @Body() dto: CreateReceivingOrderDto,
    @Request() req: { user?: { username: string } },
  ) {
    const operator = req.user?.username ?? 'system';
    return this.inboundService.create(dto, operator);
  }

  @Get()
  async findAll(@Query() query: QueryReceivingOrderDto) {
    return this.inboundService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.inboundService.findOne(id);
  }

  @Patch(':id')
  @Roles('admin', 'operator')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateReceivingOrderDto,
    @Request() req: { user?: { username: string } },
  ) {
    const operator = req.user?.username ?? 'system';
    return this.inboundService.update(id, dto, operator);
  }

  @Post(':id/submit')
  @Roles('admin', 'operator')
  async submit(
    @Param('id') id: string,
    @Request() req: { user?: { username: string } },
  ) {
    const operator = req.user?.username ?? 'system';
    return this.inboundService.submit(id, operator);
  }

  @Post(':id/complete')
  @Roles('admin', 'operator')
  async complete(
    @Param('id') id: string,
    @Request() req: { user?: { username: string } },
  ) {
    const operator = req.user?.username ?? 'system';
    return this.inboundService.complete(id, operator);
  }

  @Post(':id/cancel')
  @Roles('admin', 'operator')
  async cancel(
    @Param('id') id: string,
    @Request() req: { user?: { username: string } },
  ) {
    const operator = req.user?.username ?? 'system';
    return this.inboundService.cancel(id, operator);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') id: string,
    @Request() req: { user?: { username: string } },
  ) {
    const operator = req.user?.username ?? 'system';
    await this.inboundService.remove(id, operator);
  }
}
