import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export class CreateZoneDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsString()
  warehouseId!: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  status?: string;
}
