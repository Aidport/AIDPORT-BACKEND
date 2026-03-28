import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Shipment, ShipmentDocument, ShipmentStatus } from './entities/shipment.entity';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { UpdateShipmentDto } from './dto/update-shipment.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';

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
  ) {}

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
                ShipmentStatus.InTransit,
                ShipmentStatus.Delayed,
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
    const query = { status: ShipmentStatus.Pending };
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

  async findOne(id: string) {
    const shipment = await this.shipmentModel
      .findById(id)
      .populate('createdBy', 'name email')
      .populate('acceptedBy', 'name email')
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
      amount: number;
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
    if (shipment.acceptedBy?.toString() !== agentId) {
      throw new ForbiddenException('Only the assigned agent can add or update rates');
    }
    shipment.amount = dto.amount;
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
    if (shipment.acceptedBy?.toString() !== agentId) {
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
}
