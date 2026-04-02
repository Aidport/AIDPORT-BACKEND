import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ShipmentRateKind } from '../../shipment/entities/shipment.entity';

export class ShipmentRateLineDto {
  @ApiProperty({ enum: ShipmentRateKind, example: ShipmentRateKind.Local })
  @IsEnum(ShipmentRateKind)
  type: ShipmentRateKind;

  @ApiProperty({ example: 'Lagos-Ajah', required: false })
  @ValidateIf((o: ShipmentRateLineDto) => o.type === ShipmentRateKind.Local)
  @IsString()
  @MaxLength(300)
  originZone?: string;

  @ApiProperty({ example: 'Abuja-Central', required: false })
  @ValidateIf((o: ShipmentRateLineDto) => o.type === ShipmentRateKind.Local)
  @IsString()
  @MaxLength(300)
  destinationZone?: string;

  @ApiProperty({ example: 'Nigeria', required: false })
  @ValidateIf((o: ShipmentRateLineDto) => o.type === ShipmentRateKind.International)
  @IsString()
  @MaxLength(200)
  originCountry?: string;

  @ApiProperty({ example: 'Ghana', required: false })
  @ValidateIf((o: ShipmentRateLineDto) => o.type === ShipmentRateKind.International)
  @IsString()
  @MaxLength(200)
  destinationCountry?: string;

  @ApiProperty({ example: 12000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price: number;
}

export class AgentAddRatesDto {
  @ApiProperty({
    type: [ShipmentRateLineDto],
    example: [
      {
        type: 'local',
        originZone: 'Zone A',
        destinationZone: 'Zone B',
        price: 12000,
      },
      {
        type: 'international',
        originCountry: 'Nigeria',
        destinationCountry: 'UK',
        price: 12000,
      },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ShipmentRateLineDto)
  rates: ShipmentRateLineDto[];

  @ApiPropertyOptional({ example: 'NGN' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  carrierName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  carrierSlug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  trackingNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  trackingUrl?: string;
}
