import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage, Types } from 'mongoose';
import { User, UserDocument } from '../user/entities/user.entity';
import {
  Shipment,
  ShipmentDocument,
  ShipmentStatus,
} from '../shipment/entities/shipment.entity';
import { UserService } from '../user/user.service';
import { ShipmentService, ShipmentStatsSummary } from '../shipment/shipment.service';
import { Role } from '../../common/decorators/roles.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { UpdateProfileDto } from '../user/dto/update-profile.dto';
import { QuotesService } from '../quotes/quotes.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { QuoteStatus } from '../quotes/entities/quote.entity';
import {
  AdminAgentsQueryDto,
  AdminShipmentsQueryDto,
  AdminShippersQueryDto,
  AdminListUsersQueryDto,
  UpdatePlatformSettingsDto,
} from './dto/admin-query.dto';
import {
  AdminUpdateAgentPatchDto,
  UpdateAgentStatusDto,
} from './dto/update-agent-status.dto';
import { UpdateShipmentDto } from '../shipment/dto/update-shipment.dto';
import { SendInvoiceDto } from '../shipment/dto/send-invoice.dto';
import { AssignShipmentDto } from '../shipment/dto/assign-shipment.dto';
import { MarkShipmentPaidDto } from './dto/mark-shipment-paid.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Shipment.name) private shipmentModel: Model<ShipmentDocument>,
    private userService: UserService,
    private shipmentService: ShipmentService,
    private quotesService: QuotesService,
    private platformSettingsService: PlatformSettingsService,
  ) {}

  async getUsers(pagination: PaginationDto) {
    return this.userService.findAll(pagination, Role.User);
  }

  async getAgents(pagination: PaginationDto) {
    return this.userService.findAll(pagination, Role.Agent);
  }

  async getShipments(pagination: PaginationDto, status?: ShipmentStatus) {
    return this.shipmentService.findAll(
      pagination,
      status ? { status } : undefined,
    );
  }

  async createUser(dto: CreateUserDto, role: Role) {
    return this.userService.create(dto, role);
  }

  /** Shippers table: search, country, shipment counts */
  async getShippers(query: AdminShippersQueryDto) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;
    const match: Record<string, unknown> = { role: Role.User };
    if (query.country) {
      match.country = new RegExp(escapeRegex(query.country), 'i');
    }
    if (query.search) {
      const r = new RegExp(escapeRegex(query.search), 'i');
      const or: Record<string, unknown>[] = [
        { name: r },
        { email: r },
      ];
      if (Types.ObjectId.isValid(query.search)) {
        try {
          or.push({ _id: new Types.ObjectId(query.search) });
        } catch {
          /* ignore */
        }
      }
      match.$or = or;
    }

    const pipeline: PipelineStage[] = [
      { $match: match },
      {
        $lookup: {
          from: 'shipments',
          localField: '_id',
          foreignField: 'createdBy',
          as: '_shipmentDocs',
        },
      },
      {
        $addFields: {
          shipmentCount: { $size: '$_shipmentDocs' },
        },
      },
      {
        $project: {
          _shipmentDocs: 0,
          passwordHash: 0,
          passwordResetToken: 0,
          resetUrlToken: 0,
          emailVerificationToken: 0,
          refreshToken: 0,
        },
      },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
    ];

    const [items, total] = await Promise.all([
      this.userModel.aggregate(pipeline).exec(),
      this.userModel.countDocuments(match),
    ]);

    const itemsWithStats = await Promise.all(
      (items as { _id: Types.ObjectId }[]).map(async (row) => ({
        ...row,
        shipmentStats: await this.shipmentService.getShipmentStatsForShipper(
          row._id.toString(),
        ),
      })),
    );

    return {
      items: itemsWithStats,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /** Agents: search, category, application status */
  async getAgentsList(query: AdminAgentsQueryDto) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;
    const match: Record<string, unknown> = { role: Role.Agent };
    if (query.agentStatus) {
      match['agentProfile.status'] = query.agentStatus;
    }
    if (query.category) {
      match['agentProfile.category'] = new RegExp(
        escapeRegex(query.category),
        'i',
      );
    }
    if (query.search) {
      const r = new RegExp(escapeRegex(query.search), 'i');
      match.$or = [
        { name: r },
        { email: r },
        { 'agentProfile.companyName': r },
      ];
    }

    const [items, total] = await Promise.all([
      this.userModel
        .find(match)
        .select(
          '-passwordHash -passwordResetToken -resetUrlToken -emailVerificationToken -refreshToken',
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.userModel.countDocuments(match),
    ]);

    return {
      items: await Promise.all(
        items.map((row) =>
          this.withShipmentStats(
            row as unknown as { _id: Types.ObjectId; role?: string } & Record<string, unknown>,
          ),
        ),
      ),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getAgentById(id: string) {
    const agent = await this.userModel
      .findOne({ _id: id, role: Role.Agent })
      .select(
        '-passwordHash -passwordResetToken -resetUrlToken -emailVerificationToken -refreshToken',
      )
      .lean()
      .exec();
    if (!agent) throw new NotFoundException('Agent not found');
    const withFiles = await this.attachUploadedFileUrls(agent as unknown as {
      _id: Types.ObjectId;
      role?: string;
      agentProfile?: { documentUrls?: string[] };
    });
    return this.withShipmentStats(
      withFiles as { _id: Types.ObjectId; role?: string } & Record<string, unknown>,
    );
  }

  async updateAgentStatus(id: string, dto: UpdateAgentStatusDto) {
    const agent = await this.userModel.findOne({ _id: id, role: Role.Agent }).exec();
    if (!agent) throw new NotFoundException('Agent not found');
    agent.agentProfile = agent.agentProfile ?? {};
    agent.agentProfile.status = dto.status;
    await agent.save();
    return this.getAgentById(id);
  }

  async patchAgent(id: string, dto: AdminUpdateAgentPatchDto) {
    const agent = await this.userModel.findOne({ _id: id, role: Role.Agent }).exec();
    if (!agent) throw new NotFoundException('Agent not found');
    agent.agentProfile = agent.agentProfile ?? {};
    if (dto.pricingPlan !== undefined)
      agent.agentProfile.pricingPlan = dto.pricingPlan;
    if (dto.companyName !== undefined)
      agent.agentProfile.companyName = dto.companyName;
    if (dto.dateEstablished !== undefined)
      agent.agentProfile.dateEstablished = new Date(dto.dateEstablished);
    if (dto.location !== undefined) agent.agentProfile.location = dto.location;
    if (dto.aboutCompany !== undefined)
      agent.agentProfile.aboutCompany = dto.aboutCompany;
    if (dto.transportModes !== undefined)
      agent.agentProfile.transportModes = dto.transportModes;
    if (dto.isVerified !== undefined)
      agent.agentProfile.isVerified = dto.isVerified;
    if (dto.logisticsId !== undefined)
      agent.agentProfile.logisticsId = dto.logisticsId;
    if (dto.trucksCount !== undefined)
      agent.agentProfile.trucksCount = dto.trucksCount;
    if (dto.loadCapacity !== undefined)
      agent.agentProfile.loadCapacity = dto.loadCapacity;
    if (dto.category !== undefined) agent.agentProfile.category = dto.category;
    if (dto.agentStatus !== undefined)
      agent.agentProfile.status = dto.agentStatus;
    if (dto.documentUrls !== undefined)
      agent.agentProfile.documentUrls = dto.documentUrls;
    if (dto.businessAccountNumber !== undefined)
      agent.agentProfile.businessAccountNumber = dto.businessAccountNumber;
    await agent.save();
    return this.getAgentById(id);
  }

  async getShipmentsForAdmin(query: AdminShipmentsQueryDto) {
    let userIdsForSearch: Types.ObjectId[] | undefined;
    if (query.search) {
      const r = new RegExp(escapeRegex(query.search), 'i');
      const users = await this.userModel
        .find({
          $or: [{ name: r }, { email: r }],
        })
        .select('_id')
        .lean()
        .exec();
      userIdsForSearch = users.map((u) => u._id as Types.ObjectId);
    }

    return this.shipmentService.findForAdmin(
      { page: query.page, limit: query.limit },
      {
        search: query.search,
        dashboardFilter: query.filter,
        status: query.status,
        cargoType: query.cargoType,
        userIdsForSearch,
      },
    );
  }

  async getOrderHistory(query: AdminShipmentsQueryDto) {
    return this.getShipmentsForAdmin({
      ...query,
      status: ShipmentStatus.Delivered,
    });
  }

  async getShipperById(id: string) {
    const u = await this.userModel
      .findOne({ _id: id, role: Role.User })
      .select(
        '-passwordHash -passwordResetToken -resetUrlToken -emailVerificationToken -refreshToken',
      )
      .lean()
      .exec();
    if (!u) throw new NotFoundException('Shipper not found');
    const shipmentCount = await this.shipmentModel.countDocuments({
      createdBy: new Types.ObjectId(id),
    });
    const withFiles = await this.attachUploadedFileUrls(
      u as unknown as { _id: Types.ObjectId; role?: string; agentProfile?: { documentUrls?: string[] } },
    );
    const shipmentStats = await this.shipmentService.getShipmentStatsForShipper(id);
    return { ...withFiles, shipmentCount, shipmentStats };
  }

  async updateShipper(id: string, dto: UpdateProfileDto) {
    const u = await this.userModel
      .findOneAndUpdate({ _id: id, role: Role.User }, { $set: dto }, { new: true })
      .select(
        '-passwordHash -passwordResetToken -resetUrlToken -emailVerificationToken -refreshToken',
      )
      .lean()
      .exec();
    if (!u) throw new NotFoundException('Shipper not found');
    return u;
  }

  async updateShipmentAdmin(id: string, dto: UpdateShipmentDto) {
    return this.shipmentService.update(id, dto);
  }

  async getUserById(id: string) {
    const u = await this.userModel
      .findById(id)
      .select(
        '-passwordHash -passwordResetToken -resetUrlToken -emailVerificationToken -refreshToken',
      )
      .lean()
      .exec();
    if (!u) throw new NotFoundException('User not found');
    const withFiles = await this.attachUploadedFileUrls(
      u as unknown as { _id: Types.ObjectId; role?: string; agentProfile?: { documentUrls?: string[] } },
    );
    return this.withShipmentStats(
      withFiles as { _id: Types.ObjectId; role?: string } & Record<string, unknown>,
    );
  }

  /**
   * Agents: `agentProfile.documentUrls`. Shippers: distinct `imageUrls` from their shipments.
   * List endpoint only fills agent docs; use `GET .../users/:id` for shipper file URLs.
   */
  private static emptyShipmentStats(): ShipmentStatsSummary {
    return { pending: 0, cancelled: 0, delivered: 0, in_transit: 0 };
  }

  private async withShipmentStats(u: {
    _id: Types.ObjectId;
    role?: string;
  } & Record<string, unknown>): Promise<
    typeof u & { shipmentStats: ShipmentStatsSummary }
  > {
    if (u.role === Role.User) {
      return {
        ...u,
        shipmentStats: await this.shipmentService.getShipmentStatsForShipper(
          u._id.toString(),
        ),
      };
    }
    if (u.role === Role.Agent) {
      return {
        ...u,
        shipmentStats: await this.shipmentService.getShipmentStatsForAgent(
          u._id.toString(),
        ),
      };
    }
    return { ...u, shipmentStats: AdminService.emptyShipmentStats() };
  }

  private async attachUploadedFileUrls(u: {
    _id: Types.ObjectId;
    role?: string;
    agentProfile?: { documentUrls?: string[] };
  }) {
    if (u.role === Role.Agent) {
      const docs = u.agentProfile?.documentUrls;
      return {
        ...u,
        uploadedFileUrls: Array.isArray(docs) ? docs : [],
      };
    }
    if (u.role === Role.User) {
      const rows = await this.shipmentModel
        .find({ createdBy: u._id })
        .select('imageUrls')
        .lean()
        .exec();
      const seen = new Set<string>();
      for (const r of rows) {
        for (const im of r.imageUrls ?? []) {
          if (im) seen.add(String(im));
        }
      }
      return { ...u, uploadedFileUrls: [...seen] };
    }
    return { ...u, uploadedFileUrls: [] as string[] };
  }

  async updateUserByAdmin(id: string, dto: UpdateAdminUserDto) {
    const u = await this.userModel.findById(id).exec();
    if (!u) throw new NotFoundException('User not found');
    if (dto.userState !== undefined) {
      u.userState = dto.userState;
    }
    await u.save();
    return this.getUserById(id);
  }

  async listUsers(query: AdminListUsersQueryDto) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;
    const match: Record<string, unknown> = {};
    match.role = query.role ?? Role.User;
    if (query.country) {
      match.country = new RegExp(escapeRegex(query.country), 'i');
    }
    if (query.search) {
      const r = new RegExp(escapeRegex(query.search), 'i');
      match.$or = [{ name: r }, { email: r }];
    }

    const [raw, total] = await Promise.all([
      this.userModel
        .find(match)
        .select(
          '-passwordHash -passwordResetToken -resetUrlToken -emailVerificationToken -refreshToken',
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.userModel.countDocuments(match),
    ]);

    const items = await Promise.all(
      raw.map(async (row) => {
        const base =
          row.role === Role.Agent
            ? (() => {
                const docs = row.agentProfile?.documentUrls;
                return {
                  ...row,
                  uploadedFileUrls: Array.isArray(docs) ? docs : [],
                };
              })()
            : { ...row, uploadedFileUrls: [] as string[] };
        return this.withShipmentStats(
          base as { _id: Types.ObjectId; role?: string } & Record<string, unknown>,
        );
      }),
    );

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

  async getPlatformSettings() {
    return this.platformSettingsService.getOrCreate();
  }

  async updatePlatformSettings(dto: UpdatePlatformSettingsDto) {
    return this.platformSettingsService.update(dto);
  }

  async getQuotesForAdmin(status?: QuoteStatus, page?: number, limit?: number) {
    return this.quotesService.findAllForAdmin({ status, page, limit });
  }

  async updateQuoteStatus(quoteId: string, status: 'approved' | 'rejected') {
    const mapped =
      status === 'approved' ? QuoteStatus.Approved : QuoteStatus.Rejected;
    return this.quotesService.updateStatus(quoteId, mapped);
  }

  getNotifications() {
    return { items: [] as { id: string; title: string; read: boolean; createdAt: string }[] };
  }

  /** Full dashboard payload for admin Overview */
  async getAnalytics() {
    const [
      totalShippers,
      totalAgents,
      totalShipments,
      revenueAgg,
      quoteBreakdown,
      shipmentStats,
    ] = await Promise.all([
      this.userModel.countDocuments({ role: Role.User }),
      this.userModel.countDocuments({ role: Role.Agent }),
      this.shipmentModel.countDocuments(),
      this.shipmentModel
        .aggregate<{ total: number }>([
          { $match: { amount: { $exists: true, $gt: 0 } } },
          { $group: { _id: null, total: { $sum: '$amount' } } },
        ])
        .exec(),
      this.quotesService.countByStatus(),
      this.shipmentService.getPlatformShipmentStats(),
    ]);

    const totalRevenue = revenueAgg[0]?.total ?? 0;

    const now = new Date();
    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const [
      shipmentsByMonth,
      registrationsByMonth,
      topRoutes,
      recentShipments,
      shipmentsByStatus,
    ] = await Promise.all([
      this.shipmentModel
        .aggregate<{ _id: string; count: number }>([
          { $match: { createdAt: { $gte: twelveMonthsAgo } } },
          {
            $group: {
              _id: {
                $dateToString: { format: '%Y-%m', date: '$createdAt' },
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ])
        .exec(),
      this.userModel
        .aggregate<{ _id: string; count: number }>([
          { $match: { createdAt: { $gte: twelveMonthsAgo } } },
          {
            $group: {
              _id: {
                $dateToString: { format: '%Y-%m', date: '$createdAt' },
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ])
        .exec(),
      this.shipmentModel
        .aggregate<{ _id: { o: string; d: string }; count: number }>([
          {
            $group: {
              _id: {
                o: '$originCity',
                d: '$destinationCity',
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ])
        .exec(),
      this.shipmentModel
        .find()
        .populate('createdBy', 'name email')
        .populate('acceptedBy', 'name email agentProfile')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean()
        .exec(),
      this.shipmentModel
        .aggregate<{ _id: ShipmentStatus; count: number }>([
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ])
        .exec(),
    ]);

    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const [pendingShipments, deliveredShipments, recentShipmentsCount] =
      await Promise.all([
        this.shipmentModel.countDocuments({ status: ShipmentStatus.Pending }),
        this.shipmentModel.countDocuments({ status: ShipmentStatus.Delivered }),
        this.shipmentModel.countDocuments({ createdAt: { $gte: weekAgo } }),
      ]);

    return {
      overview: {
        totalShipments,
        totalAgents,
        totalShippers,
        totalRevenue,
        pendingShipments,
        deliveredShipments,
        recentShipmentsCount,
        shipmentStats,
      },
      quoteActivity: quoteBreakdown,
      shipmentsOverTime: shipmentsByMonth.map((m) => ({
        month: m._id,
        count: m.count,
      })),
      newUserRegistrations: registrationsByMonth.map((m) => ({
        month: m._id,
        count: m.count,
      })),
      topTradeRoutes: topRoutes.map((r) => ({
        origin: r._id.o,
        destination: r._id.d,
        count: r.count,
      })),
      recentShipments,
      shipmentsByStatus: shipmentsByStatus.map((s) => ({
        status: s._id,
        count: s.count,
      })),
    };
  }

  sendShipmentInvoice(id: string, dto: SendInvoiceDto) {
    return this.shipmentService.sendInvoiceToShipper(id, dto);
  }

  assignShipment(id: string, dto: AssignShipmentDto) {
    return this.shipmentService.assignAgentAfterPayment(id, dto.assignedAgentId);
  }

  markShipmentPaid(id: string, dto?: MarkShipmentPaidDto) {
    return this.shipmentService.markShipmentPaid(id, dto);
  }
}
