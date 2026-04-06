import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId } from 'class-validator';

export class AssignShipmentDto {
  @ApiProperty({ description: 'Agent user id to assign after payment' })
  @IsMongoId()
  assignedAgentId: string;
}
