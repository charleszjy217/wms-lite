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

export class UpdateShippingOrderItemDto {
  @IsString()
  @MinLength(1)
  productId!: string;

  @IsNumber()
  @Min(0.001)
  quantity!: number;
}

export class UpdateShippingOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsDateString()
  shipmentDate?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateShippingOrderItemDto)
  @ArrayMinSize(1)
  items?: UpdateShippingOrderItemDto[];
}
