import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, Min } from 'class-validator';

/** Standalone contra price on the agent profile (separate from rate lines). */
export class SetAgentContraPriceDto {
  @ApiProperty({
    description: 'Independent of local/international rate lines.',
    example: 25000,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  contraPrice: number;
}
