import { IsOptional, IsString, IsIn } from 'class-validator';

export class QuerySummaryDto {
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  @IsIn(['product', 'warehouse'])
  groupBy?: 'product' | 'warehouse';
}
