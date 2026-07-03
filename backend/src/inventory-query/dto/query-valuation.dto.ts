import { IsOptional, IsString, IsIn } from 'class-validator';

export class QueryValuationDto {
  @IsOptional()
  @IsString()
  priceListId?: string;

  @IsOptional()
  @IsString()
  warehouseId?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @IsIn(['warehouse', 'category'])
  groupBy?: 'warehouse' | 'category';
}
