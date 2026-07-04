import { Controller, Get, Query } from '@nestjs/common';
import { InventoryQueryService } from './inventory-query.service';
import { QueryBalanceDto } from './dto/query-balance.dto';
import { QueryMovementDto } from './dto/query-movement.dto';
import { QueryExpiryReportDto } from './dto/query-expiry-report.dto';
import { QueryValuationDto } from './dto/query-valuation.dto';
import { QuerySummaryDto } from './dto/query-summary.dto';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('inventory-query')
export class InventoryQueryController {
  constructor(private readonly service: InventoryQueryService) {}

  @Get('balances')
  @Roles('admin', 'operator')
  async findBalances(@Query() query: QueryBalanceDto) {
    return this.service.findBalances(query);
  }

  @Get('movements')
  @Roles('admin', 'operator')
  async findMovements(@Query() query: QueryMovementDto) {
    return this.service.findMovements(query);
  }

  @Get('expiry-report')
  @Roles('admin', 'operator')
  async findExpiryReport(@Query() query: QueryExpiryReportDto) {
    return this.service.findExpiryReport(query);
  }

  @Get('valuation')
  @Roles('admin', 'operator')
  async findValuation(@Query() query: QueryValuationDto) {
    return this.service.findValuation(query);
  }

  @Get('summary')
  @Roles('admin', 'operator')
  async findSummary(@Query() query: QuerySummaryDto) {
    return this.service.findSummary(query);
  }
}
