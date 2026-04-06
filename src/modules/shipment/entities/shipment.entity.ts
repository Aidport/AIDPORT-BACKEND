import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ShipmentDocument = Shipment & Document;

export enum ShipmentCategory {
  Medical = 'medical',
  Food = 'food',
  Clothing = 'clothing',
  Equipment = 'equipment',
  Other = 'other',
}

export enum ShipmentStatus {
  Draft = 'draft',
  Pending = 'pending',
  /** Shipper sent a targeted request to a specific agent */
  Requested = 'requested',
  Accepted = 'accepted',
  /** Agent accepted the request (operational) */
  Processing = 'processing',
  Declined = 'declined',
  InTransit = 'in_transit',
  PickedUp = 'picked_up',
  Delayed = 'delayed',
  Delivered = 'delivered',
  Cancelled = 'cancelled',
  /** Payment received (admin / Paystack); assign agent next */
  Paid = 'paid',
}

export enum PickupMethod {
  Terminal = 'terminal',
  Dispatch = 'dispatch',
}

export enum PaymentStatus {
  Pending = 'pending',
  Paid = 'paid',
}

/** Address for pickup or delivery (TShip-style) */
@Schema({ _id: false })
export class ShipmentAddress {
  @Prop({ required: true })
  line1: string;

  @Prop()
  line2?: string;

  @Prop({ required: true })
  city: string;

  @Prop({ required: true })
  state: string;

  @Prop({ required: true })
  country: string;

  @Prop()
  zip?: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  phone: string;

  @Prop()
  email?: string;
}

/** Parcel item (TShip-style) */
@Schema({ _id: false })
export class ParcelItem {
  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  @Prop({ default: 'parcel' })
  type?: 'document' | 'parcel';

  @Prop({ default: 'NGN' })
  currency?: string;

  @Prop({ default: 0 })
  value?: number;

  @Prop({ required: true })
  quantity: number;

  @Prop({ required: true })
  weight: number;
}

/** Shipment status event (TShip-style) */
@Schema({ _id: false })
export class ShipmentEvent {
  @Prop({ required: true })
  status: string;

  @Prop()
  description?: string;

  @Prop()
  location?: string;

  @Prop({ default: () => new Date() })
  createdAt: Date;
}

const ShipmentAddressSchema = SchemaFactory.createForClass(ShipmentAddress);
const ParcelItemSchema = SchemaFactory.createForClass(ParcelItem);
const ShipmentEventSchema = SchemaFactory.createForClass(ShipmentEvent);

/** Line stored on shipment after admin sends invoice */
@Schema({ _id: false })
export class InvoiceLineItem {
  @Prop({ required: true })
  name: string;

  @Prop()
  quantity?: number;

  @Prop({ required: true })
  price: number;
}

const InvoiceLineItemSchema = SchemaFactory.createForClass(InvoiceLineItem);

export enum ShipmentRateKind {
  Local = 'local',
  International = 'international',
}

/** One commercial rate line (local zones vs international countries). */
@Schema({ _id: false })
export class ShipmentRateLine {
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

  /** Base / list price for the route */
  @Prop()
  basicPrice?: number;

  @Prop({ required: true })
  price: number;
}

export const ShipmentRateLineSchema = SchemaFactory.createForClass(ShipmentRateLine);

@Schema({ timestamps: true })
export class Shipment {
  @Prop({ required: true })
  cargoName: string;

  @Prop()
  cargoType?: string;

  @Prop()
  weight?: string;

  @Prop()
  dimensions?: string;

  @Prop({ required: true, enum: ShipmentCategory })
  category: ShipmentCategory;

  @Prop({ required: true })
  originCity: string;

  @Prop({ required: true })
  destinationCity: string;

  /** Full pickup address (TShip-style) */
  @Prop({ type: ShipmentAddressSchema })
  addressFrom?: ShipmentAddress;

  /** Full delivery address (TShip-style) */
  @Prop({ type: ShipmentAddressSchema })
  addressTo?: ShipmentAddress;

  /** Parcel items (TShip-style) */
  @Prop({ type: [ParcelItemSchema], default: [] })
  parcelItems?: ParcelItem[];

  @Prop()
  preferredPickupDate?: Date;

  @Prop({ default: false })
  urgency: boolean;

  @Prop({ enum: PickupMethod })
  pickupMethod?: PickupMethod;

  @Prop({ default: PaymentStatus.Pending, enum: PaymentStatus })
  paymentStatus: PaymentStatus;

  @Prop({ default: ShipmentStatus.Pending, enum: ShipmentStatus })
  status: ShipmentStatus;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;

  /** Agent the shipper addressed (when status is `requested`) */
  @Prop({ type: Types.ObjectId, ref: 'User' })
  requestedAgentId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  acceptedBy?: Types.ObjectId;

  /** Set by admin after payment (primary “assigned agent” for this shipment) */
  @Prop({ type: Types.ObjectId, ref: 'User' })
  assignedAgentId?: Types.ObjectId;

  @Prop({ type: [InvoiceLineItemSchema], default: [] })
  invoiceLineItems?: InvoiceLineItem[];

  @Prop()
  invoiceTotalPrice?: number;

  @Prop()
  paymentLink?: string;

  @Prop()
  invoiceSentAt?: Date;

  @Prop()
  deliveredAt?: Date;

  @Prop({ type: [String], default: [] })
  imageUrls?: string[];

  /** Status events / tracking history (TShip-style) */
  @Prop({ type: [ShipmentEventSchema], default: [] })
  events?: ShipmentEvent[];

  /** Tracking number from carrier */
  @Prop()
  trackingNumber?: string;

  /** Tracking URL */
  @Prop()
  trackingUrl?: string;

  /** Detailed rate lines from the assigned agent */
  @Prop({ type: [ShipmentRateLineSchema], default: [] })
  rates?: ShipmentRateLine[];

  /** Shipping cost / rate amount (typically sum of `rates[].price`) */
  @Prop()
  amount?: number;

  @Prop({ default: 'NGN' })
  currency?: string;

  /** Carrier name */
  @Prop()
  carrierName?: string;

  @Prop()
  carrierSlug?: string;
}

export const ShipmentSchema = SchemaFactory.createForClass(Shipment);
