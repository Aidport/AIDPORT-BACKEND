import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum QuoteStatus {
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
}

export type QuoteDocument = Quote & Document;

@Schema({ timestamps: true })
export class Quote {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

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
