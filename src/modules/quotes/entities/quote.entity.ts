import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum QuoteStatus {
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
  /** Agent accepted the quote (linked shipment assigned to agent) */
  Accepted = 'accepted',
}

export type QuoteDocument = Quote & Document;

@Schema({ timestamps: true })
export class Quote {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  /** Shipment this quote request applies to (shipper flow) */
  @Prop({ type: Types.ObjectId, ref: 'Shipment' })
  shipmentId?: Types.ObjectId;

  /** Agent who accepted this quote */
  @Prop({ type: Types.ObjectId, ref: 'User' })
  acceptedByAgentId?: Types.ObjectId;

  /** Rate amount proposed when agent accepted (optional snapshot) */
  @Prop()
  agentRateAmount?: number;

  @Prop()
  originCity?: string;

  @Prop()
  originCountry?: string;

  @Prop()
  destinationCity?: string;

  @Prop()
  destinationCountry?: string;

  @Prop()
  weightKg?: number;

  @Prop({ enum: QuoteStatus, default: QuoteStatus.Pending })
  status: QuoteStatus;

  @Prop()
  notes?: string;
}

export const QuoteSchema = SchemaFactory.createForClass(Quote);
