import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateQuoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  originCity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  originCountry?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  destinationCity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  destinationCountry?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  weightKg?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
