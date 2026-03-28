import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Role } from '../../../common/decorators/roles.decorator';
import { AgentProfile, AgentProfileSchema } from './agent-profile.schema';

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

  @Prop({ default: Role.User, enum: Role })
  role: Role;

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

  @Prop({ type: UserSettingsSchema, default: () => ({}) })
  settings?: UserSettings;

  @Prop()
  refreshToken?: string;

  @Prop()
  passwordResetToken?: string;

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
}

export const UserSchema = SchemaFactory.createForClass(User);
