import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  BadGatewayException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  PaymentStatus,
  Shipment,
  ShipmentDocument,
  ShipmentRateKind,
  ShipmentRateLine,
  ShipmentStatus,
} from './entities/shipment.entity';
import { User, UserDocument } from '../user/entities/user.entity';
import { Role } from '../../common/decorators/roles.decorator';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { SendShipmentRequestDto } from './dto/send-shipment-request.dto';
import { UpdateShipmentDto } from './dto/update-shipment.dto';
import { UpdateShipmentStatusDto } from './dto/update-shipment-status.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { EmailService } from '../../integrations/email/email.service';
import { SendInvoiceDto } from './dto/send-invoice.dto';

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export type ShipmentAdminFilter =
  | 'all'
  | 'active'
  | 'cancelled'
  | 'pending'
  | 'drafts';

@Injectable()
export class ShipmentService {
  constructor(
    @InjectModel(Shipment.name) private shipmentModel: Model<ShipmentDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly emailService: EmailService,
  ) {}

  /** Assigned agent is `assignedAgentId` (admin flow) or legacy `acceptedBy` only. */
  private isAssignedAgent(shipment: ShipmentDocument, agentId: string): boolean {
    if (shipment.assignedAgentId?.toString() === agentId) {
      return true;
    }
    if (
      shipment.acceptedBy?.toString() === agentId &&
      !shipment.assignedAgentId
    ) {
      return true;
    }
    return false;
  }

  async create(createShipmentDto: CreateShipmentDto, userId: string) {
    const shipment = new this.shipmentModel({
      ...createShipmentDto,
      imageUrls: createShipmentDto.imageUrls ?? [],
      parcelItems: createShipmentDto.parcelItems ?? [],
      preferredPickupDate: createShipmentDto.preferredPickupDate
        ? new Date(createShipmentDto.preferredPickupDate)
        : undefined,
      createdBy: new Types.ObjectId(userId),
      events: [
        {
          status: 'created',
          description: 'Shipment created',
          location: `${createShipmentDto.originCity} → ${createShipmentDto.destinationCity}`,
          createdAt: new Date(),
        },
      ],
    });
    return shipment.save();
  }

  async findAll(pagination: PaginationDto, filters?: { status?: ShipmentStatus }) {
    const { page = 1, limit = 10 } = pagination;
    const query = filters?.status ? { status: filters.status } : {};
    const [items, total] = await Promise.all([
      this.shipmentModel
        .find(query)
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.shipmentModel.countDocuments(query),
    ]);
    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /** Admin list: search, dashboard filter, optional exact status */
  async findForAdmin(
    pagination: PaginationDto,
    filters: {
      search?: string;
      dashboardFilter?: ShipmentAdminFilter;
      status?: ShipmentStatus;
      cargoType?: string;
      userIdsForSearch?: Types.ObjectId[];
    },
  ) {
    const { page = 1, limit = 10 } = pagination;
    const and: Record<string, unknown>[] = [];

    if (filters.status) {
      and.push({ status: filters.status });
    } else if (filters.dashboardFilter && filters.dashboardFilter !== 'all') {
      switch (filters.dashboardFilter) {
        case 'active':
          and.push({
            status: {
              $in: [
                ShipmentStatus.Accepted,
                ShipmentStatus.Processing,
                ShipmentStatus.InTransit,
                ShipmentStatus.PickedUp,
                ShipmentStatus.Delayed,
                ShipmentStatus.Paid,
              ],
            },
          });
          break;
        case 'cancelled':
          and.push({ status: ShipmentStatus.Cancelled });
          break;
        case 'pending':
          and.push({ status: ShipmentStatus.Pending });
          break;
        case 'drafts':
          and.push({ status: ShipmentStatus.Draft });
          break;
        default:
          break;
      }
    }

    if (filters.cargoType) {
      and.push({
        cargoType: new RegExp(escapeRegex(filters.cargoType), 'i'),
      });
    }

    if (filters.search) {
      const r = new RegExp(escapeRegex(filters.search), 'i');
      const or: Record<string, unknown>[] = [
        { cargoName: r },
        { originCity: r },
        { destinationCity: r },
        { trackingNumber: r },
      ];
      if (Types.ObjectId.isValid(filters.search)) {
        try {
          or.push({ _id: new Types.ObjectId(filters.search) });
        } catch {
          /* ignore invalid hex */
        }
      }
      if (filters.userIdsForSearch?.length) {
        or.push({ createdBy: { $in: filters.userIdsForSearch } });
        or.push({ acceptedBy: { $in: filters.userIdsForSearch } });
        or.push({ assignedAgentId: { $in: filters.userIdsForSearch } });
      }
      and.push({ $or: or });
    }

    const query =
      and.length === 0 ? {} : and.length === 1 ? and[0] : { $and: and };

    const [items, total] = await Promise.all([
      this.shipmentModel
        .find(query)
        .populate('createdBy', 'name email city country')
        .populate('acceptedBy', 'name email agentProfile')
        .populate('assignedAgentId', 'name email agentProfile')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.shipmentModel.countDocuments(query),
    ]);
    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findIncoming(agentId: string, pagination: PaginationDto) {
    const { page = 1, limit = 10 } = pagination;
    const query = {
      $or: [
        { status: ShipmentStatus.Pending },
        {
          status: ShipmentStatus.Requested,
          requestedAgentId: new Types.ObjectId(agentId),
        },
      ],
    };
    const [items, total] = await Promise.all([
      this.shipmentModel
        .find(query)
        .populate('createdBy', 'name email')
        .sort({ urgency: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.shipmentModel.countDocuments(query),
    ]);
    return {
      items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /** Shipments where admin set `assignedAgentId` to this agent. */
  async findAssignedByAgent(agentId: string, pagination: PaginationDto) {
    const { page = 1, limit = 10 } = pagination;
    const oid = new Types.ObjectId(agentId);
    const query = { assignedAgentId: oid };
    const [items, total] = await Promise.all([
      this.shipmentModel
        .find(query)
        .populate('createdBy', 'name email')
        .populate('assignedAgentId', 'name email')
        .sort({ urgency: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.shipmentModel.countDocuments(query),
    ]);
    return {
      items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const shipment = await this.shipmentModel
      .findById(id)
      .populate('createdBy', 'name email')
      .populate('requestedAgentId', 'name email agentProfile')
      .populate('acceptedBy', 'name email')
      .populate('assignedAgentId', 'name email agentProfile')
      .exec();
    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }
    return shipment;
  }

  async update(id: string, updateShipmentDto: UpdateShipmentDto, userId?: string) {
    const shipment = await this.shipmentModel.findById(id).exec();
    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }
    Object.assign(shipment, updateShipmentDto);
    return shipment.save();
  }

  /** Shipper targets an agent; shipment starts as `requested`. */
  async sendShipmentRequest(dto: SendShipmentRequestDto, userId: string) {
    const agent = await this.userModel.findById(dto.agentId).exec();
    if (!agent || agent.role !== Role.Agent) {
      throw new BadRequestException('agentId must be a valid agent user');
    }
    const { agentId, ...fields } = dto;
    const shipment = new this.shipmentModel({
      ...fields,
      imageUrls: fields.imageUrls ?? [],
      parcelItems: fields.parcelItems ?? [],
      preferredPickupDate: fields.preferredPickupDate
        ? new Date(fields.preferredPickupDate)
        : undefined,
      createdBy: new Types.ObjectId(userId),
      requestedAgentId: new Types.ObjectId(agentId),
      status: ShipmentStatus.Requested,
      events: [
        {
          status: 'requested',
          description: 'Shipment request sent to agent',
          location: `${fields.originCity} → ${fields.destinationCity}`,
          createdAt: new Date(),
        },
      ],
    });
    return shipment.save();
  }

  /** Requested agent accepts → `processing`, assigns agent. */
  async acceptShipmentRequest(id: string, agentId: string) {
    const shipment = await this.shipmentModel.findById(id).exec();
    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }
    if (shipment.status !== ShipmentStatus.Requested) {
      throw new ForbiddenException('Shipment is not awaiting acceptance');
    }
    if (shipment.requestedAgentId?.toString() !== agentId) {
      throw new ForbiddenException('Only the requested agent can accept this shipment');
    }
    shipment.status = ShipmentStatus.Processing;
    shipment.acceptedBy = new Types.ObjectId(agentId);
    this.addEvent(shipment, 'processing', 'Agent accepted shipment request');
    return shipment.save();
  }

  /** Requested agent declines → `declined`. */
  async declineShipmentRequest(id: string, agentId: string) {
    const shipment = await this.shipmentModel.findById(id).exec();
    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }
    if (shipment.status !== ShipmentStatus.Requested) {
      throw new ForbiddenException('Shipment is not awaiting a decision');
    }
    if (shipment.requestedAgentId?.toString() !== agentId) {
      throw new ForbiddenException('Only the requested agent can decline this shipment');
    }
    shipment.status = ShipmentStatus.Declined;
    this.addEvent(shipment, 'declined', 'Agent declined shipment request');
    return shipment.save();
  }

  /** Assigned agent updates operational status (`in_transit` | `picked_up` | `delivered`). */
  async updateShipmentStatusByAgent(
    id: string,
    agentId: string,
    dto: UpdateShipmentStatusDto,
  ) {
    const shipment = await this.shipmentModel.findById(id).exec();
    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }
    if (!this.isAssignedAgent(shipment, agentId)) {
      throw new ForbiddenException('Only the assigned agent can update shipment status');
    }
    if (shipment.status === ShipmentStatus.Delivered) {
      throw new ForbiddenException('Shipment is already delivered');
    }
    const allowedCurrent: ShipmentStatus[] = [
      ShipmentStatus.Processing,
      ShipmentStatus.Accepted,
      ShipmentStatus.InTransit,
      ShipmentStatus.PickedUp,
      ShipmentStatus.Delayed,
    ];
    if (!allowedCurrent.includes(shipment.status)) {
      throw new ForbiddenException('Shipment status cannot be updated from the current state');
    }
    shipment.status = dto.status;
    if (dto.status === ShipmentStatus.Delivered) {
      shipment.deliveredAt = new Date();
    }
    this.addEvent(
      shipment,
      dto.status,
      `Status updated to ${dto.status}`,
      shipment.originCity && shipment.destinationCity
        ? `${shipment.originCity} → ${shipment.destinationCity}`
        : undefined,
    );
    return shipment.save();
  }

  private addEvent(shipment: ShipmentDocument, status: string, description?: string, location?: string) {
    const events = shipment.events ?? [];
    events.push({ status, description, location, createdAt: new Date() });
    shipment.events = events;
  }

  async accept(id: string, agentId: string) {
    const shipment = await this.shipmentModel.findById(id).exec();
    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }
    if (shipment.status !== ShipmentStatus.Pending) {
      throw new ForbiddenException('Shipment is no longer available');
    }
    shipment.status = ShipmentStatus.Accepted;
    shipment.acceptedBy = new Types.ObjectId(agentId);
    this.addEvent(shipment, 'accepted', 'Shipment accepted by agent');
    return shipment.save();
  }

  async decline(id: string, agentId: string) {
    const shipment = await this.shipmentModel.findById(id).exec();
    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }
    if (shipment.status !== ShipmentStatus.Pending) {
      throw new ForbiddenException('Shipment cannot be declined');
    }
    shipment.status = ShipmentStatus.Declined;
    this.addEvent(shipment, 'declined', 'Shipment declined by agent');
    return shipment.save();
  }

  /** Assigned agent sets or updates commercial rates on the shipment */
  async agentSetRates(
    shipmentId: string,
    agentId: string,
    dto: {
      rates: ShipmentRateLine[];
      currency?: string;
      carrierName?: string;
      carrierSlug?: string;
      trackingNumber?: string;
      trackingUrl?: string;
    },
  ) {
    const shipment = await this.shipmentModel.findById(shipmentId).exec();
    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }
    if (!this.isAssignedAgent(shipment, agentId)) {
      throw new ForbiddenException('Only the assigned agent can add or update rates');
    }
    shipment.rates = dto.rates.map((r) => ({
      type: r.type,
      price: r.price,
      ...(r.basicPrice !== undefined ? { basicPrice: r.basicPrice } : {}),
      ...(r.type === ShipmentRateKind.Local
        ? { originZone: r.originZone, destinationZone: r.destinationZone }
        : { originCountry: r.originCountry, destinationCountry: r.destinationCountry }),
    }));
    shipment.amount = dto.rates.reduce(
      (sum, r) => sum + r.price + (r.basicPrice ?? 0),
      0,
    );
    if (dto.currency !== undefined) shipment.currency = dto.currency;
    if (dto.carrierName !== undefined) shipment.carrierName = dto.carrierName;
    if (dto.carrierSlug !== undefined) shipment.carrierSlug = dto.carrierSlug;
    if (dto.trackingNumber !== undefined) {
      shipment.trackingNumber = dto.trackingNumber;
    }
    if (dto.trackingUrl !== undefined) shipment.trackingUrl = dto.trackingUrl;
    this.addEvent(
      shipment,
      'rates_set',
      'Agent set shipping rates',
      shipment.originCity && shipment.destinationCity
        ? `${shipment.originCity} → ${shipment.destinationCity}`
        : undefined,
    );
    return shipment.save();
  }

  async markDelivered(id: string, agentId: string) {
    const shipment = await this.shipmentModel.findById(id).exec();
    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }
    if (!this.isAssignedAgent(shipment, agentId)) {
      throw new ForbiddenException('Only the assigned agent can mark as delivered');
    }
    shipment.status = ShipmentStatus.Delivered;
    shipment.deliveredAt = new Date();
    this.addEvent(shipment, 'delivered', 'Shipment delivered');
    return shipment.save();
  }

  /** Get tracking info (TShip-style) */
  async track(id: string, userId: string) {
    const shipment = await this.shipmentModel
      .findById(id)
      .populate('createdBy', 'name email')
      .populate('acceptedBy', 'name email')
      .exec();
    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }
    if (shipment.createdBy?.toString() !== userId) {
      throw new ForbiddenException('You can only track your own shipments');
    }
    return {
      id: shipment._id,
      status: shipment.status,
      trackingNumber: shipment.trackingNumber,
      trackingUrl: shipment.trackingUrl,
      events: shipment.events ?? [],
      addressFrom: shipment.addressFrom,
      addressTo: shipment.addressTo,
      carrierName: shipment.carrierName,
      deliveredAt: shipment.deliveredAt,
    };
  }

  /** Get estimated rates (TShip-style) - based on weight/distance logic */
  async getRates(params: {
    originCity: string;
    destinationCity: string;
    weightKg: number;
    currency?: string;
  }) {
    const { originCity, destinationCity, weightKg, currency = 'NGN' } = params;
    const baseRate = 500;
    const perKgRate = 200;
    const estimatedAmount = Math.round(baseRate + weightKg * perKgRate);
    return {
      rates: [
        {
          rate_id: 'standard',
          amount: estimatedAmount,
          currency,
          carrier_name: 'Aidport Standard',
          carrier_slug: 'aidport-standard',
          delivery_time: 'Within 3-5 days',
          pickup_time: 'Within 24 hours',
        },
        {
          rate_id: 'express',
          amount: Math.round(estimatedAmount * 1.5),
          currency,
          carrier_name: 'Aidport Express',
          carrier_slug: 'aidport-express',
          delivery_time: 'Within 1-2 days',
          pickup_time: 'Within 12 hours',
        },
      ],
    };
  }

  /** Admin: persist invoice snapshot, email shipper (payment link), and notify linked agent if any. */
  async sendInvoiceToShipper(shipmentId: string, dto: SendInvoiceDto) {
    const shipment = await this.shipmentModel.findById(shipmentId).exec();
    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }
    const shipper = await this.userModel.findById(shipment.createdBy).exec();
    if (!shipper?.email) {
      throw new BadRequestException('Shipper has no email on file');
    }
    shipment.invoiceLineItems = dto.parcelItems.map((p) => ({
      name: p.name,
      quantity: p.quantity,
      price: p.price,
    }));
    shipment.invoiceTotalPrice = dto.totalPrice;
    shipment.paymentLink = dto.paymentLink;
    shipment.invoiceSentAt = new Date();
    await shipment.save();

    if (!this.emailService.isConfigured()) {
      throw new BadRequestException(
        'Invoice saved but SMTP is not configured (set SMTP_USER / SMTP_PASS); email was not sent',
      );
    }

    try {
      await this.emailService.sendShipmentInvoiceEmail({
        to: shipper.email,
        recipientName: shipper.name ?? 'there',
        cargoName: shipment.cargoName,
        originCity: shipment.originCity,
        destinationCity: shipment.destinationCity,
        parcelItems: dto.parcelItems,
        totalPrice: dto.totalPrice,
        paymentLink: dto.paymentLink,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new BadGatewayException(
        `Invoice was saved. Email to the shipper failed: ${msg}. ` +
          'Gmail SMTP from cloud hosts (e.g. Render) often hits connection timeouts or blocks; use a transactional email API (Resend, SendGrid, Mailgun) or an SMTP relay that allows your server IP.',
      );
    }

    const agentRef =
      shipment.assignedAgentId ?? shipment.acceptedBy ?? shipment.requestedAgentId;
    if (agentRef) {
      const agent = await this.userModel.findById(agentRef).exec();
      if (
        agent?.email &&
        agent.role === Role.Agent &&
        agent.email.toLowerCase() !== shipper.email.toLowerCase()
      ) {
        try {
          await this.emailService.sendShipmentInvoiceAgentNotifyEmail({
            to: agent.email,
            agentName: agent.name ?? 'there',
            shipmentId: String(shipment._id),
            cargoName: shipment.cargoName,
            originCity: shipment.originCity,
            destinationCity: shipment.destinationCity,
            shipperName: shipper.name ?? 'Customer',
            shipperEmail: shipper.email,
            totalPrice: dto.totalPrice,
            paymentLink: dto.paymentLink,
          });
        } catch {
          /* agent copy is best-effort; shipper email already sent */
        }
      }
    }

    return this.shipmentModel
      .findById(shipmentId)
      .populate('createdBy', 'name email')
      .populate('assignedAgentId', 'name email')
      .exec();
  }

  /** Admin: mark shipment paid (e.g. after Paystack confirmation). */
  async markShipmentPaid(shipmentId: string) {
    const shipment = await this.shipmentModel.findById(shipmentId).exec();
    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }
    shipment.paymentStatus = PaymentStatus.Paid;
    shipment.status = ShipmentStatus.Paid;
    this.addEvent(shipment, ShipmentStatus.Paid, 'Payment received');
    return shipment.save();
  }

  /** Admin: assign agent after payment; moves status to processing. */
  async assignAgentAfterPayment(
    shipmentId: string,
    assignedAgentId: string,
  ) {
    const agent = await this.userModel.findById(assignedAgentId).exec();
    if (!agent || agent.role !== Role.Agent) {
      throw new BadRequestException('assignedAgentId must be a valid agent user');
    }
    const shipment = await this.shipmentModel.findById(shipmentId).exec();
    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }
    if (shipment.paymentStatus !== PaymentStatus.Paid) {
      throw new ForbiddenException('Shipment must be paid before assigning an agent');
    }
    shipment.assignedAgentId = new Types.ObjectId(assignedAgentId);
    shipment.acceptedBy = new Types.ObjectId(assignedAgentId);
    shipment.status = ShipmentStatus.Processing;
    this.addEvent(
      shipment,
      ShipmentStatus.Processing,
      'Agent assigned by admin',
      shipment.originCity && shipment.destinationCity
        ? `${shipment.originCity} → ${shipment.destinationCity}`
        : undefined,
    );
    return shipment.save();
  }
}
