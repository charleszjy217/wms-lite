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

export class TransferItemDto {
  @IsString()
  @IsUUID()
  productId!: string;

  @IsString()
  @IsUUID()
  batchId!: string;

  @IsNumber()
  @Min(0.001)
  quantity!: number;
}

export class CreateTransferDto {
  @IsString()
  @IsUUID()
  sourceWarehouseId!: string;

  @IsString()
  @IsUUID()
  sourceLocationId!: string;

  @IsString()
  @IsUUID()
  targetWarehouseId!: string;

  @IsString()
  @IsUUID()
  targetLocationId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  referenceNo?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransferItemDto)
  @ArrayMinSize(1)
  items!: TransferItemDto[];
}
