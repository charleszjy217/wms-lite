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

export class CreateReceivingOrderItemDto {
  @IsString()
  @MinLength(1)
  productId!: string;

  @IsOptional()
  @IsString()
  batchId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  batchNo!: string;

  @IsOptional()
  @IsDateString()
  productionDate?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsNumber()
  @Min(0.001)
  quantity!: number;
}

export class CreateReceivingOrderDto {
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
  receiptDate?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateReceivingOrderItemDto)
  @ArrayMinSize(1)
  items!: CreateReceivingOrderItemDto[];
}
