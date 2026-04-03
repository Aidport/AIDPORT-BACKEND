import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  ShipmentRateLine,
  ShipmentRateLineSchema,
} from '../../shipment/entities/shipment.entity';

export enum AgentStatus {
  PendingReview = 'pending_review',
  Approved = 'approved',
  Declined = 'declined',
  Active = 'active',
  Inactive = 'inactive',
}

export enum AgentPricingPlan {
  Premium = 'premium',
  Basic = 'basic',
}

export enum TransportMode {
  Air = 'air',
  Multimodal = 'multimodal',
  Land = 'land',
  Sea = 'sea',
}

@Schema({ _id: false })
export class AgentProfile {
  @Prop({ enum: AgentPricingPlan })
  pricingPlan?: AgentPricingPlan;

  @Prop()
  companyName?: string;

  @Prop()
  dateEstablished?: Date;

  @Prop()
  location?: string;

  @Prop()
  aboutCompany?: string;

  @Prop({ type: [String], enum: Object.values(TransportMode), default: [] })
  transportModes?: TransportMode[];

  @Prop({ default: false })
  isVerified?: boolean;

  @Prop()
  logisticsId?: string;

  @Prop({ default: 0 })
  trucksCount?: number;

  @Prop()
  loadCapacity?: string;

  @Prop({ enum: AgentStatus, default: AgentStatus.PendingReview })
  status?: AgentStatus;

  @Prop({ type: [String], default: [] })
  documentUrls?: string[];

  /** Default pricing lines (local / international); empty until PATCH /agent/rates */
  @Prop({ type: [ShipmentRateLineSchema], default: [] })
  rates?: ShipmentRateLine[];

  @Prop()
  category?: string;
}

export const AgentProfileSchema = SchemaFactory.createForClass(AgentProfile);
