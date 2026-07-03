import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  IsEnum,
  IsArray,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

// ── PriceList ─────────────────────────────────────────────────────

export class CreatePriceListDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  status?: string;
}

export class UpdatePriceListDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  status?: string;
}

// ── ProductPrice ──────────────────────────────────────────────────

export class CreateProductPriceDto {
  @IsUUID()
  priceListId!: string;

  @IsUUID()
  productId!: string;

  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsDateString()
  effectiveDate!: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;
}

export class UpdateProductPriceDto {
  @IsNumber()
  @Min(0)
  @IsOptional()
  unitPrice?: number;

  @IsDateString()
  @IsOptional()
  effectiveDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string | null;
}

// ── Single Price Adjustment ──────────────────────────────────────

export class AdjustProductPriceDto {
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsDateString()
  effectiveDate!: string;

  @IsString()
  @IsOptional()
  reason?: string;
}

// ── Batch Price Adjustment ───────────────────────────────────────

export enum AdjustmentMode {
  FIXED = 'fixed',
  PERCENTAGE = 'percentage',
}

export class BatchUpdatePriceDto {
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  productIds?: string[];

  @IsEnum(AdjustmentMode)
  mode!: AdjustmentMode;

  @IsNumber()
  adjustmentValue!: number;

  @IsDateString()
  effectiveDate!: string;

  @IsString()
  reason!: string;
}

// ── PriceChangeLog Query ─────────────────────────────────────────

export class PriceChangeLogQueryDto {
  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;
}

// ── Paginated Response ───────────────────────────────────────────

export class PaginatedResult<T> {
  items!: T[];
  total!: number;
  page!: number;
  limit!: number;
  totalPages!: number;
}
