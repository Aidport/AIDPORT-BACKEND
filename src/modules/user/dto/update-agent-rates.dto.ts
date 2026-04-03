import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { ShipmentRateLineDto } from '../../agent/dto/agent-add-rates.dto';

/** Replaces the agent profile `rates` list (default `[]` after signup). */
export class UpdateAgentRatesDto {
  @ApiProperty({
    type: [ShipmentRateLineDto],
    description: 'Full list of rate lines to store. Use [] to clear.',
  })
  @IsArray()
  @ArrayMinSize(0)
  @ValidateNested({ each: true })
  @Type(() => ShipmentRateLineDto)
  rates: ShipmentRateLineDto[];
}
