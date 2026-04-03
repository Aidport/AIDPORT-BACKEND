import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class AddInternationalAgentRateDto {
  @ApiProperty({ example: 'Nigeria' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  originCountry: string;

  @ApiProperty({ example: 'United Kingdom' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  destinationCountry: string;

  @ApiProperty({ example: 12000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price: number;
}
