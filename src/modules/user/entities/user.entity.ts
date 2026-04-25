import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Role } from '../../../common/decorators/roles.decorator';
import { AgentProfile, AgentProfileSchema } from './agent-profile.schema';
import { UserAccountState } from './user-account-state.enum';

export type UserDocument = User & Document;

@Schema({ _id: false })
export class UserSettings {
  @Prop({ default: true })
  emailNotifications?: boolean;

  @Prop({ default: true })
  pushNotifications?: boolean;

  @Prop({ default: true })
  shipmentUpdates?: boolean;

  @Prop({ default: 'en' })
  language?: string;

  @Prop({ default: 'UTC' })
  timezone?: string;
}

const UserSettingsSchema = SchemaFactory.createForClass(UserSettings);

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ type: String, enum: Object.values(Role), default: Role.User })
  role: Role;

  @Prop({ enum: Object.values(UserAccountState), default: UserAccountState.Active })
  userState: UserAccountState;

  @Prop()
  phone?: string;

  @Prop()
  address?: string;

  @Prop()
  city?: string;

  @Prop()
  state?: string;

  @Prop()
  zipCode?: string;

  @Prop()
  country?: string;

  @Prop()
  avatarUrl?: string;

  /** Shipper (role user): URLs from POST /upload/* appended here; used with shipment `imageUrls` for admin `uploadedFileUrls`. */
  @Prop({ type: [String], default: [] })
  shipperFileUrls?: string[];

  /** Admin: URLs from POST /upload/* — same pattern as shippers, separate array for role `admin`. */
  @Prop({ type: [String], default: [] })
  adminFileUrls?: string[];

  @Prop({ type: UserSettingsSchema, default: () => ({}) })
  settings?: UserSettings;

  @Prop()
  refreshToken?: string;

  @Prop()
  passwordResetToken?: string;

  /** Opaque segment for reset URL (`?uid=…&reset=…`). Cleared after successful reset. */
  @Prop()
  resetUrlToken?: string;

  @Prop()
  passwordResetExpires?: Date;

  @Prop({ default: false })
  isEmailVerified?: boolean;

  @Prop()
  emailVerificationToken?: string;

  @Prop()
  emailVerificationExpires?: Date;

  @Prop()
  gender?: string;

  @Prop()
  dateOfBirth?: Date;

  /** Agent-only: company / fleet / verification */
  @Prop({ type: AgentProfileSchema })
  agentProfile?: AgentProfile;

  /**
   * Legacy / frontend shape (Atlas often has `agencyProfile.agencyLogo`).
   * Kept in sync with `agentProfile` when the API writes; also used to hydrate if `agentProfile` is missing.
   */
  @Prop({ type: MongooseSchema.Types.Mixed })
  agencyProfile?: Record<string, unknown>;
}

export const UserSchema = SchemaFactory.createForClass(User);
