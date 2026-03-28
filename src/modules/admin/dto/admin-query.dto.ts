import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { ShipmentStatus } from '../../shipment/entities/shipment.entity';
import { AgentStatus } from '../../user/entities/agent-profile.schema';

export enum ShipmentDashboardFilter {
  All = 'all',
  Active = 'active',
  Cancelled = 'cancelled',
  Pending = 'pending',
  Drafts = 'drafts',
}

export class AdminShipmentsQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsEnum(ShipmentDashboardFilter)
  filter?: ShipmentDashboardFilter;

  @IsOptional()
  @IsEnum(ShipmentStatus)
  status?: ShipmentStatus;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  cargoType?: string;
}

export class AdminShippersQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  country?: string;
}

export class AdminAgentsQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @IsOptional()
  @IsEnum(AgentStatus)
  agentStatus?: AgentStatus;
}

export class AdminListUsersQueryDto extends PaginationDto {
  @IsOptional()
  @IsIn(['user', 'agent', 'admin'])
  role?: 'user' | 'agent' | 'admin';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  country?: string;
}

export class UpdatePlatformSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  platformName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(254)
  adminEmail?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  notifyNewSystemUpdates?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  notifyNewShipment?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  notifyVerificationUpdate?: boolean;
}
