import { PartialType } from '@nestjs/mapped-types';
import { CreateShipmentDto } from './create-shipment.dto';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { ShipmentStatus } from '../entities/shipment.entity';

export class UpdateShipmentDto extends PartialType(CreateShipmentDto) {
  @IsOptional()
  @IsEnum(ShipmentStatus)
  status?: ShipmentStatus;

  @IsOptional()
  @IsString()
  trackingNumber?: string;

  @IsOptional()
  @IsString()
  trackingUrl?: string;

  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsString()
  carrierName?: string;

  @IsOptional()
  @IsString()
  carrierSlug?: string;
}
