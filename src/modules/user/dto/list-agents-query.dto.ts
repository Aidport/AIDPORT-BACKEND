import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { TransportMode } from '../entities/agent-profile.schema';

export class ListAgentsQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Search name, company name, or location' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ enum: TransportMode })
  @IsOptional()
  @IsEnum(TransportMode)
  transportMode?: TransportMode;
}
