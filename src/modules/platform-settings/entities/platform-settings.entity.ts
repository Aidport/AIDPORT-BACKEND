import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PlatformSettingsDocument = PlatformSettings & Document;

@Schema({ timestamps: true, collection: 'platform_settings' })
export class PlatformSettings {
  @Prop({ default: 'Aidport' })
  platformName: string;

  @Prop()
  adminEmail?: string;

  @Prop({ default: true })
  notifyNewSystemUpdates: boolean;

  @Prop({ default: true })
  notifyNewShipment: boolean;

  @Prop({ default: true })
  notifyVerificationUpdate: boolean;
}

export const PlatformSettingsSchema =
  SchemaFactory.createForClass(PlatformSettings);
