import { Role } from '../../../common/decorators/roles.decorator';
import {
  AgentPricingPlan,
  AgentStatus,
  TransportMode,
} from '../entities/agent-profile.schema';
import type { ShipmentRateLine } from '../../shipment/entities/shipment.entity';

export interface AgentProfileResponse {
  pricingPlan?: AgentPricingPlan;
  companyName?: string;
  dateEstablished?: string;
  location?: string;
  aboutCompany?: string;
  transportModes?: TransportMode[];
  isVerified?: boolean;
  logisticsId?: string;
  trucksCount?: number;
  loadCapacity?: string;
  status?: AgentStatus;
  documentUrls?: string[];
  rates?: ShipmentRateLine[];
  category?: string;
}

export interface UserSettingsResponse {
  emailNotifications?: boolean;
  pushNotifications?: boolean;
  shipmentUpdates?: boolean;
  language?: string;
  timezone?: string;
}

export interface UserResponse {
  id: string;
  name: string;
  email: string;
  role: Role;
  isEmailVerified?: boolean;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  avatarUrl?: string;
  settings?: UserSettingsResponse;
  agentProfile?: AgentProfileResponse;
}
