import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export enum AgentStatus {
  PendingReview = 'pending_review',
  Approved = 'approved',
  Declined = 'declined',
  Active = 'active',
  Inactive = 'inactive',
}

@Schema({ _id: false })
export class AgentProfile {
  @Prop()
  companyName?: string;

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

  @Prop()
  category?: string;
}

export const AgentProfileSchema = SchemaFactory.createForClass(AgentProfile);
