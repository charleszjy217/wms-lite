import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  Min,
  MinLength,
  MaxLength,
  IsDateString,
} from 'class-validator';

export class CreateShippingOrderItemDto {
  @IsString()
  @MinLength(1)
  productId!: string;

  @IsNumber()
  @Min(0.001)
  quantity!: number;
}

export class CreateShippingOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  referenceNo?: string;

  @IsString()
  @MinLength(1)
  warehouseId!: string;

  @IsString()
  @MinLength(1)
  locationId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsDateString()
  shipmentDate?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateShippingOrderItemDto)
  @ArrayMinSize(1)
  items!: CreateShippingOrderItemDto[];
}
