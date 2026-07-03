import {
  IsString,
  IsOptional,
  IsDateString,
  MinLength,
  MaxLength,
} from 'class-validator';

export class CreateBatchDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  batchNo!: string;

  @IsString()
  @MinLength(1)
  productId!: string;

  @IsOptional()
  @IsDateString()
  productionDate?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  status?: string;
}
