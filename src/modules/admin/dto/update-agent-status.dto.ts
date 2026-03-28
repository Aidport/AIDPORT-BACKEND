import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { AgentStatus } from '../../user/entities/agent-profile.schema';

export class UpdateAgentStatusDto {
  @IsEnum(AgentStatus)
  status: AgentStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class AdminUpdateAgentPatchDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  companyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  logisticsId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  trucksCount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  loadCapacity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @IsOptional()
  @IsEnum(AgentStatus)
  agentStatus?: AgentStatus;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  documentUrls?: string[];
}

export class UpdateQuoteStatusDto {
  @IsIn(['approved', 'rejected'])
  status: 'approved' | 'rejected';
}
