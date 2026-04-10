import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Min } from 'class-validator';

/** Contra / contract-style rate line (no geography). */
export class AddContraAgentRateDto {
  @ApiPropertyOptional({ example: 5000, description: 'Optional base / list component' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  basicPrice?: number;

  @ApiProperty({ example: 12000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price: number;
}
