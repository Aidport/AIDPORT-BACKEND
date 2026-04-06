import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class AddLocalAgentRateDto {
  @ApiProperty({ example: 'Lagos Island' })
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  originZone: string;

  @ApiProperty({ example: 'Abuja Central' })
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  destinationZone: string;

  @ApiProperty({ example: 12000, required: false, description: 'Base / list price' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  basicPrice?: number;

  @ApiProperty({ example: 5000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price: number;
}
