import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateZoneDto {
  @IsString()
  @IsOptional()
  @MaxLength(50)
  code?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  name?: string;

  @IsString()
  @IsOptional()
  warehouseId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  status?: string;
}
