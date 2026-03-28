import { Role } from '../../../common/decorators/roles.decorator';

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
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  avatarUrl?: string;
  settings?: UserSettingsResponse;
}
