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
import { OutboundService } from './outbound.service';
import { CreateShippingOrderDto } from './dto/create-shipping-order.dto';
import { UpdateShippingOrderDto } from './dto/update-shipping-order.dto';
import { QueryShippingOrderDto } from './dto/query-shipping-order.dto';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('outbound/shipping-orders')
export class OutboundController {
  constructor(private readonly outboundService: OutboundService) {}

  @Post()
  @Roles('admin', 'operator')
  async create(
    @Body() dto: CreateShippingOrderDto,
    @Request() req: { user?: { username: string } },
  ) {
    const operator = req.user?.username ?? 'system';
    return this.outboundService.create(dto, operator);
  }

  @Get()
  async findAll(@Query() query: QueryShippingOrderDto) {
    return this.outboundService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.outboundService.findOne(id);
  }

  @Get(':id/fefo-suggestions')
  @Roles('admin', 'operator')
  async getFefoSuggestions(@Param('id') id: string) {
    return this.outboundService.getFefoSuggestions(id);
  }

  @Patch(':id')
  @Roles('admin', 'operator')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateShippingOrderDto,
    @Request() req: { user?: { username: string } },
  ) {
    const operator = req.user?.username ?? 'system';
    return this.outboundService.update(id, dto, operator);
  }

  @Post(':id/submit')
  @Roles('admin', 'operator')
  async submit(
    @Param('id') id: string,
    @Request() req: { user?: { username: string } },
  ) {
    const operator = req.user?.username ?? 'system';
    return this.outboundService.submit(id, operator);
  }

  @Post(':id/complete')
  @Roles('admin', 'operator')
  async complete(
    @Param('id') id: string,
    @Request() req: { user?: { username: string } },
  ) {
    const operator = req.user?.username ?? 'system';
    return this.outboundService.complete(id, operator);
  }

  @Post(':id/cancel')
  @Roles('admin', 'operator')
  async cancel(
    @Param('id') id: string,
    @Request() req: { user?: { username: string } },
  ) {
    const operator = req.user?.username ?? 'system';
    return this.outboundService.cancel(id, operator);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') id: string,
    @Request() req: { user?: { username: string } },
  ) {
    const operator = req.user?.username ?? 'system';
    await this.outboundService.remove(id, operator);
  }
}
