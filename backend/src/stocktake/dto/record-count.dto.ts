import { IsArray, IsString, IsUUID, IsNumber, Min, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

export class RecordCountItemDto {
  @IsString()
  @IsUUID()
  id!: string;

  @IsNumber()
  @Min(0)
  actualQuantity!: number;
}

export class RecordCountDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecordCountItemDto)
  @ArrayMinSize(1)
  items!: RecordCountItemDto[];
}
