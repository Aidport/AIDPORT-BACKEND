import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { TransportMode } from '../entities/agent-profile.schema';

function emptyToUndefined(v: unknown) {
  return v === '' || v === null || v === undefined ? undefined : v;
}

export class ListAgentsQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Search name, company name, or location' })
  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ enum: TransportMode })
  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsEnum(TransportMode)
  transportMode?: TransportMode;
}
