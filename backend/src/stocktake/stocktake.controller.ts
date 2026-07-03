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
import { StocktakeService } from './stocktake.service';
import { CreateStocktakeDto } from './dto/create-stocktake.dto';
import { RecordCountDto } from './dto/record-count.dto';
import { QueryStocktakeDto } from './dto/query-stocktake.dto';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('stocktakes')
export class StocktakeController {
  constructor(private readonly stocktakeService: StocktakeService) {}

  @Post()
  @Roles('admin', 'operator')
  async create(@Body() dto: CreateStocktakeDto, @Request() req: { user?: { username: string } }) {
    const operator = req.user?.username ?? 'system';
    return this.stocktakeService.create(dto, operator);
  }

  @Get()
  async findAll(@Query() query: QueryStocktakeDto) {
    return this.stocktakeService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.stocktakeService.findOne(id);
  }

  @Post(':id/record-count')
  @Roles('admin', 'operator')
  @HttpCode(HttpStatus.OK)
  async recordCount(
    @Param('id') id: string,
    @Body() dto: RecordCountDto,
    @Request() req: { user?: { username: string } },
  ) {
    const operator = req.user?.username ?? 'system';
    return this.stocktakeService.recordCount(id, dto, operator);
  }

  @Post(':id/confirm')
  @Roles('admin', 'operator')
  @HttpCode(HttpStatus.OK)
  async confirm(@Param('id') id: string, @Request() req: { user?: { username: string } }) {
    const operator = req.user?.username ?? 'system';
    return this.stocktakeService.confirm(id, operator);
  }

  @Post(':id/cancel')
  @Roles('admin', 'operator')
  @HttpCode(HttpStatus.OK)
  async cancel(@Param('id') id: string, @Request() req: { user?: { username: string } }) {
    const operator = req.user?.username ?? 'system';
    return this.stocktakeService.cancel(id, operator);
  }
}
