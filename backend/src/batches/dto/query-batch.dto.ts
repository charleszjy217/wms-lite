import {
  IsOptional,
  IsString,
  IsInt,
  IsBoolean,
  IsDateString,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum SortExpiryOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class QueryBatchDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  batchNo?: string;

  @IsOptional()
  @IsDateString()
  expiryDateFrom?: string;

  @IsOptional()
  @IsDateString()
  expiryDateTo?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  nearExpiry?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  expired?: boolean;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsEnum(SortExpiryOrder)
  sortByExpiry?: SortExpiryOrder;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
