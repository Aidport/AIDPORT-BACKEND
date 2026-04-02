import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { ShipmentStatus } from '../entities/shipment.entity';

/** Assigned agent updates operational status after acceptance (`processing` → … → `delivered`). */
const AGENT_PATCHABLE_STATUSES = [
  ShipmentStatus.InTransit,
  ShipmentStatus.PickedUp,
  ShipmentStatus.Delivered,
] as const;

export class UpdateShipmentStatusDto {
  @ApiProperty({
    enum: AGENT_PATCHABLE_STATUSES,
    example: ShipmentStatus.InTransit,
  })
  @IsIn([...AGENT_PATCHABLE_STATUSES])
  status: (typeof AGENT_PATCHABLE_STATUSES)[number];
}
