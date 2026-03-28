import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class AgentAddRatesDto {
  @Type(() => Number)
  @IsNumber()
  amount: number;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  carrierName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  carrierSlug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  trackingNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  trackingUrl?: string;
}
