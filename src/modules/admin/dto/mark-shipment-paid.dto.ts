import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Min } from 'class-validator';

export class MarkShipmentPaidDto {
  @ApiPropertyOptional({
    description: 'Defaults to invoiceTotalPrice when omitted.',
    example: 40000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amountPaid?: number;
}
