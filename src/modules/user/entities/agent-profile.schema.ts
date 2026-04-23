import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { ShipmentRateKind } from '../../shipment/entities/shipment.entity';

/** Embedded rate line with own `_id` for CRUD on agent profile. */
@Schema()
export class AgentRateLine {
  _id?: Types.ObjectId;

  @Prop({ required: true, enum: Object.values(ShipmentRateKind) })
  type: ShipmentRateKind;

  @Prop()
  originZone?: string;

  @Prop()
  destinationZone?: string;

  @Prop()
  originCountry?: string;

  @Prop()
  destinationCountry?: string;

  @Prop()
  basicPrice?: number;

  @Prop({ required: true })
  price: number;
}

export const AgentRateLineSchema = SchemaFactory.createForClass(AgentRateLine);

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
  SeaCargo = 'sea_cargo',
  AirCargo = 'air_cargo',
  FreightForwarder = 'freight_forwarder',
  ClearingAndForwarding = 'clearing_and_forwarding',
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

  /** Business / settlement account number (bank or platform-specific). */
  @Prop()
  businessAccountNumber?: string;

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

  /** Single logo URL (many clients / legacy DB use this instead of `documentUrls`). */
  @Prop()
  agencyLogo?: string;

  /** Local / international / contra pricing lines (each has Mongo subdocument id) */
  @Prop({ type: [AgentRateLineSchema], default: [] })
  rates?: AgentRateLine[];

  /** Standalone contra price (optional; separate from rate lines). International rates remain optional. */
  @Prop()
  contraPrice?: number;

  @Prop()
  category?: string;
}

export const AgentProfileSchema = SchemaFactory.createForClass(AgentProfile);
