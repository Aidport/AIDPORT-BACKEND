import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  AgentPricingPlan,
  AgentStatus,
  TransportMode,
} from '../../user/entities/agent-profile.schema';

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
  @IsEnum(AgentPricingPlan)
  pricingPlan?: AgentPricingPlan;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  companyName?: string;

  @IsOptional()
  @IsDateString()
  dateEstablished?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  aboutCompany?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(TransportMode, { each: true })
  transportModes?: TransportMode[];

  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;

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

  @IsOptional()
  @IsString()
  @MaxLength(80)
  businessAccountNumber?: string;
}

export class UpdateQuoteStatusDto {
  @IsIn(['approved', 'rejected'])
  status: 'approved' | 'rejected';
}
