import {
  IsString,
  IsArray,
  IsUUID,
  IsNumber,
  Min,
  IsOptional,
  MaxLength,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class StocktakeItemDto {
  @IsString()
  @IsUUID()
  productId!: string;

  @IsString()
  @IsUUID()
  batchId!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  expectedQuantity?: number;
}

export class CreateStocktakeDto {
  @IsString()
  @IsUUID()
  warehouseId!: string;

  @IsString()
  @IsUUID()
  locationId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  referenceNo?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StocktakeItemDto)
  @ArrayMinSize(1)
  items!: StocktakeItemDto[];
}
