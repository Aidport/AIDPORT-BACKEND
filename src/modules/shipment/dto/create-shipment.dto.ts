import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsDateString,
  IsNumber,
  IsArray,
  ValidateNested,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PickupMethod, ShipmentCategory } from '../entities/shipment.entity';

/** Address DTO (TShip-style) */
export class AddressDto {
  @IsString()
  @MinLength(1)
  line1: string;

  @IsOptional()
  @IsString()
  line2?: string;

  @IsString()
  @MinLength(1)
  city: string;

  @IsString()
  @MinLength(1)
  state: string;

  @IsString()
  @MinLength(2)
  country: string;

  @IsOptional()
  @IsString()
  zip?: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @MinLength(1)
  phone: string;

  @IsOptional()
  @IsString()
  email?: string;
}

/** Parcel item DTO (TShip-style) */
export class ParcelItemDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  type?: 'document' | 'parcel';

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsNumber()
  value?: number;

  @IsNumber()
  quantity: number;

  @IsNumber()
  weight: number;
}

export class CreateShipmentDto {
  @IsString()
  @MinLength(1)
  cargoName: string;

  @IsOptional()
  @IsString()
  cargoType?: string;

  @IsOptional()
  @IsString()
  weight?: string;

  @IsOptional()
  @IsString()
  dimensions?: string;

  @IsEnum(ShipmentCategory)
  category: ShipmentCategory;

  @IsString()
  @MinLength(1)
  originCity: string;

  @IsString()
  @MinLength(1)
  destinationCity: string;

  /** Full pickup address (TShip-style) */
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  addressFrom?: AddressDto;

  /** Full delivery address (TShip-style) */
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  addressTo?: AddressDto;

  /** Parcel items (TShip-style) */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ParcelItemDto)
  parcelItems?: ParcelItemDto[];

  @IsOptional()
  @IsDateString()
  preferredPickupDate?: string;

  @IsOptional()
  @IsBoolean()
  urgency?: boolean;

  @IsOptional()
  @IsEnum(PickupMethod)
  pickupMethod?: PickupMethod;

  @IsOptional()
  @IsString({ each: true })
  imageUrls?: string[];
}
