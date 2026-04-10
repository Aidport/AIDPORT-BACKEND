import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class AddInternationalAgentRateDto {
  @ApiPropertyOptional({
    example: 'Nigeria',
    description: 'Optional; international rate lines are not required to specify a lane.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  originCountry?: string;

  @ApiPropertyOptional({ example: 'United Kingdom' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  destinationCountry?: string;

  @ApiProperty({ example: 12000, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  basicPrice?: number;

  @ApiProperty({ example: 5000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price: number;
}
