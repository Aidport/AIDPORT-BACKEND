import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId } from 'class-validator';
import { CreateShipmentDto } from './create-shipment.dto';

/** Shipper sends a full shipment payload to a specific agent; status is set to `requested`. */
export class SendShipmentRequestDto extends CreateShipmentDto {
  @ApiProperty({ description: 'Agent user id (must be role `agent`)' })
  @IsMongoId()
  agentId: string;
}
