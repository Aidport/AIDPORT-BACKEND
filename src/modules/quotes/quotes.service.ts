import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Quote, QuoteDocument, QuoteStatus } from './entities/quote.entity';
import { Shipment, ShipmentDocument } from '../shipment/entities/shipment.entity';
import { ShipmentService } from '../shipment/shipment.service';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Injectable()
export class QuotesService {
  constructor(
    @InjectModel(Quote.name) private quoteModel: Model<QuoteDocument>,
    @InjectModel(Shipment.name) private shipmentModel: Model<ShipmentDocument>,
    @Inject(forwardRef(() => ShipmentService))
    private shipmentService: ShipmentService,
  ) {}

  async create(
    userId: string,
    data: {
      shipmentId?: string;
      originCity?: string;
      originCountry?: string;
      destinationCity?: string;
      destinationCountry?: string;
      weightKg?: number;
      notes?: string;
    },
  ) {
    let shipmentId: Types.ObjectId | undefined;
    if (data.shipmentId) {
      const shipment = await this.shipmentModel.findById(data.shipmentId).exec();
      if (!shipment) {
        throw new NotFoundException('Shipment not found');
      }
      if (shipment.createdBy?.toString() !== userId) {
        throw new ForbiddenException(
          'You can only request a quote for your own shipments',
        );
      }
      shipmentId = new Types.ObjectId(data.shipmentId);
    }

    const doc = new this.quoteModel({
      userId: new Types.ObjectId(userId),
      shipmentId,
      originCity: data.originCity,
      originCountry: data.originCountry,
      destinationCity: data.destinationCity,
      destinationCountry: data.destinationCountry,
      weightKg: data.weightKg,
      notes: data.notes,
      status: QuoteStatus.Pending,
    });
    return doc.save();
  }

  async findAllForAdmin(filters: {
    status?: QuoteStatus;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const skip = (page - 1) * limit;
    const query: Record<string, unknown> = {};
    if (filters.status) query.status = filters.status;
    const [items, total] = await Promise.all([
      this.quoteModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'name email')
        .populate('shipmentId')
        .lean()
        .exec(),
      this.quoteModel.countDocuments(query).exec(),
    ]);
    return { items, total, page, limit };
  }

  /** Quotes approved by admin and not yet taken by an agent */
  async findOpenForAgents(pagination: PaginationDto) {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;
    const query = {
      status: QuoteStatus.Approved,
      acceptedByAgentId: { $exists: false },
    };
    const [items, total] = await Promise.all([
      this.quoteModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'name email')
        .populate('shipmentId')
        .lean()
        .exec(),
      this.quoteModel.countDocuments(query).exec(),
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

  /**
   * Agent accepts an admin-approved quote linked to a pending shipment.
   * RBAC: caller must enforce Role.Agent + assertAgentCanOperate before calling.
   */
  async acceptQuoteByAgent(
    quoteId: string,
    agentId: string,
    dto?: { amount?: number },
  ) {
    const quote = await this.quoteModel.findById(quoteId).exec();
    if (!quote) {
      throw new NotFoundException('Quote not found');
    }
    if (quote.status !== QuoteStatus.Approved) {
      throw new BadRequestException(
        'Quote must be approved before an agent can accept it',
      );
    }
    if (!quote.shipmentId) {
      throw new BadRequestException('Quote is not linked to a shipment');
    }
    if (quote.acceptedByAgentId) {
      throw new BadRequestException('Quote has already been accepted');
    }

    const shipmentIdStr = String(quote.shipmentId);

    const updated = await this.quoteModel.findOneAndUpdate(
      {
        _id: quoteId,
        status: QuoteStatus.Approved,
        acceptedByAgentId: { $exists: false },
      },
      {
        $set: {
          acceptedByAgentId: new Types.ObjectId(agentId),
          status: QuoteStatus.Accepted,
          ...(dto?.amount != null ? { agentRateAmount: dto.amount } : {}),
        },
      },
      { new: true },
    );

    if (!updated) {
      throw new BadRequestException('Quote cannot be accepted');
    }

    try {
      await this.shipmentService.accept(shipmentIdStr, agentId);
    } catch (err) {
      await this.quoteModel.findByIdAndUpdate(quoteId, {
        $set: { status: QuoteStatus.Approved },
        $unset: { acceptedByAgentId: 1, agentRateAmount: 1 },
      });
      throw err;
    }

    if (dto?.amount != null) {
      await this.shipmentService.agentSetRates(shipmentIdStr, agentId, {
        amount: dto.amount,
      });
    }

    return this.quoteModel
      .findById(quoteId)
      .populate('userId', 'name email')
      .populate('shipmentId')
      .populate('acceptedByAgentId', 'name email agentProfile')
      .exec();
  }

  async updateStatus(id: string, status: QuoteStatus) {
    if (status === QuoteStatus.Accepted) {
      throw new BadRequestException(
        'Use the agent endpoint to mark a quote as accepted',
      );
    }
    const updated = await this.quoteModel
      .findByIdAndUpdate(id, { status }, { new: true })
      .exec();
    if (!updated) throw new NotFoundException('Quote not found');
    return updated;
  }

  async countByStatus() {
    const agg = await this.quoteModel
      .aggregate<{ _id: QuoteStatus; count: number }>([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ])
      .exec();
    const map: Record<string, number> = {};
    for (const row of agg) {
      map[row._id] = row.count;
    }
    return {
      pending: map[QuoteStatus.Pending] ?? 0,
      approved: map[QuoteStatus.Approved] ?? 0,
      rejected: map[QuoteStatus.Rejected] ?? 0,
      accepted: map[QuoteStatus.Accepted] ?? 0,
    };
  }
}
