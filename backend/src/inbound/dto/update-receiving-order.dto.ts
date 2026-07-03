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

export class UpdateReceivingOrderItemDto {
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

export class UpdateReceivingOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsDateString()
  receiptDate?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateReceivingOrderItemDto)
  @ArrayMinSize(1)
  items?: UpdateReceivingOrderItemDto[];
}
