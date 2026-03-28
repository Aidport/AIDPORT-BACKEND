import { IsString, IsNumber, IsOptional, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class GetRatesDto {
  @IsString()
  @MinLength(1)
  originCity: string;

  @IsString()
  @MinLength(1)
  destinationCity: string;

  @IsNumber()
  @Type(() => Number)
  weightKg: number;

  @IsOptional()
  @IsString()
  currency?: string;
}
