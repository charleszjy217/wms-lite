import {
  IsString,
  IsOptional,
  IsDateString,
  MaxLength,
} from 'class-validator';

export class UpdateBatchDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  batchNo?: string;

  @IsOptional()
  @IsString()
  productId?: string;

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
