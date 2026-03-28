import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Quote, QuoteDocument, QuoteStatus } from './entities/quote.entity';

@Injectable()
export class QuotesService {
  constructor(
    @InjectModel(Quote.name) private quoteModel: Model<QuoteDocument>,
  ) {}

  async create(
    userId: string,
    data: {
      originCity?: string;
      originCountry?: string;
      destinationCity?: string;
      destinationCountry?: string;
      weightKg?: number;
      notes?: string;
    },
  ) {
    const doc = new this.quoteModel({
      userId: new Types.ObjectId(userId),
      ...data,
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
        .lean()
        .exec(),
      this.quoteModel.countDocuments(query).exec(),
    ]);
    return { items, total, page, limit };
  }

  async updateStatus(id: string, status: QuoteStatus) {
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
    };
  }
}
