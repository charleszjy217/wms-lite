import { Controller, Get, Query } from '@nestjs/common';
import { InventoryQueryService } from './inventory-query.service';
import { QueryBalanceDto } from './dto/query-balance.dto';
import { QueryMovementDto } from './dto/query-movement.dto';
import { QueryExpiryReportDto } from './dto/query-expiry-report.dto';
import { QueryValuationDto } from './dto/query-valuation.dto';
import { QuerySummaryDto } from './dto/query-summary.dto';

@Controller('inventory-query')
export class InventoryQueryController {
  constructor(private readonly service: InventoryQueryService) {}

  @Get('balances')
  async findBalances(@Query() query: QueryBalanceDto) {
    return this.service.findBalances(query);
  }

  @Get('movements')
  async findMovements(@Query() query: QueryMovementDto) {
    return this.service.findMovements(query);
  }

  @Get('expiry-report')
  async findExpiryReport(@Query() query: QueryExpiryReportDto) {
    return this.service.findExpiryReport(query);
  }

  @Get('valuation')
  async findValuation(@Query() query: QueryValuationDto) {
    return this.service.findValuation(query);
  }

  @Get('summary')
  async findSummary(@Query() query: QuerySummaryDto) {
    return this.service.findSummary(query);
  }
}
