import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TransferService } from './transfer.service';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { QueryTransferDto } from './dto/query-transfer.dto';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('transfers')
export class TransferController {
  constructor(private readonly transferService: TransferService) {}

  @Post()
  @Roles('admin', 'operator')
  async create(@Body() dto: CreateTransferDto, @Request() req: { user?: { username: string } }) {
    const operator = req.user?.username ?? 'system';
    return this.transferService.create(dto, operator);
  }

  @Get()
  async findAll(@Query() query: QueryTransferDto) {
    return this.transferService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.transferService.findOne(id);
  }

  @Post(':id/submit')
  @Roles('admin', 'operator')
  @HttpCode(HttpStatus.OK)
  async submit(@Param('id') id: string, @Request() req: { user?: { username: string } }) {
    const operator = req.user?.username ?? 'system';
    return this.transferService.submit(id, operator);
  }

  @Post(':id/complete')
  @Roles('admin', 'operator')
  @HttpCode(HttpStatus.OK)
  async complete(@Param('id') id: string, @Request() req: { user?: { username: string } }) {
    const operator = req.user?.username ?? 'system';
    return this.transferService.complete(id, operator);
  }

  @Post(':id/cancel')
  @Roles('admin', 'operator')
  @HttpCode(HttpStatus.OK)
  async cancel(@Param('id') id: string, @Request() req: { user?: { username: string } }) {
    const operator = req.user?.username ?? 'system';
    return this.transferService.cancel(id, operator);
  }
}
