import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { PricingService } from './pricing.service';
import {
  CreatePriceListDto,
  UpdatePriceListDto,
  CreateProductPriceDto,
  UpdateProductPriceDto,
  AdjustProductPriceDto,
  BatchUpdatePriceDto,
  PriceChangeLogQueryDto,
} from './dto/pricing.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuditLog } from '../audit/decorators/audit-log.decorator';

@Controller('pricing')
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  // ===========================================================================
  // PriceList (价目表)
  // ===========================================================================

  @Post('price-lists')
  @Roles('admin')
  @AuditLog('PriceList', 'CREATE')
  async createPriceList(@Body() dto: CreatePriceListDto) {
    return this.pricingService.createPriceList(dto);
  }

  @Get('price-lists')
  async findAllPriceLists() {
    return this.pricingService.findAllPriceLists();
  }

  @Get('price-lists/:id')
  async findPriceListById(@Param('id') id: string) {
    return this.pricingService.findPriceListById(id);
  }

  @Patch('price-lists/:id')
  @Roles('admin')
  @AuditLog('PriceList', 'UPDATE')
  async updatePriceList(
    @Param('id') id: string,
    @Body() dto: UpdatePriceListDto,
  ) {
    return this.pricingService.updatePriceList(id, dto);
  }

  // ===========================================================================
  // ProductPrice (商品价格)
  // ===========================================================================

  @Post('product-prices')
  @Roles('admin', 'operator')
  @AuditLog('ProductPrice', 'CREATE')
  async createProductPrice(@Body() dto: CreateProductPriceDto) {
    return this.pricingService.createProductPrice(dto);
  }

  @Get('product-prices')
  async findAllProductPrices(
    @Query('priceListId') priceListId?: string,
    @Query('productId') productId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.pricingService.findAllProductPrices(
      priceListId,
      productId,
      page ? Number(page) : undefined,
      limit ? Number(limit) : undefined,
    );
  }

  @Get('product-prices/:id')
  async findProductPriceById(@Param('id') id: string) {
    return this.pricingService.findProductPriceById(id);
  }

  @Patch('product-prices/:id')
  @Roles('admin', 'operator')
  @AuditLog('ProductPrice', 'UPDATE')
  async updateProductPrice(
    @Param('id') id: string,
    @Body() dto: UpdateProductPriceDto,
  ) {
    return this.pricingService.updateProductPrice(id, dto);
  }

  @Delete('product-prices/:id')
  @Roles('admin')
  @AuditLog('ProductPrice', 'DELETE')
  async deleteProductPrice(@Param('id') id: string) {
    return this.pricingService.deleteProductPrice(id);
  }

  // ===========================================================================
  // Single Price Adjustment (单品调价)
  // ===========================================================================

  @Post('product-prices/:id/adjust')
  @Roles('admin', 'operator')
  @AuditLog('ProductPrice', 'PRICE_ADJUST')
  async adjustProductPrice(
    @Param('id') id: string,
    @Body() dto: AdjustProductPriceDto,
    @Req() req: Request,
  ) {
    const operator = (req.user as { username?: string })?.username ?? 'system';
    return this.pricingService.adjustProductPrice(id, dto, operator);
  }

  // ===========================================================================
  // Batch Price Adjustment (批量调价)
  // ===========================================================================

  @Post('batch-adjust')
  @Roles('admin')
  @AuditLog('ProductPrice', 'BATCH_PRICE_ADJUST')
  async batchUpdatePrice(
    @Body() dto: BatchUpdatePriceDto,
    @Req() req: Request,
  ) {
    const operator = (req.user as { username?: string })?.username ?? 'system';
    return this.pricingService.batchUpdatePrice(dto, operator);
  }

  // ===========================================================================
  // Price Change History (调价历史)
  // ===========================================================================

  @Get('change-logs')
  async findPriceChangeLogs(@Query() query: PriceChangeLogQueryDto) {
    return this.pricingService.findPriceChangeLogs(query);
  }
}
