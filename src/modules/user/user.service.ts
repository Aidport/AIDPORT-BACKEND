import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { CompleteAgentProfileDto } from './dto/complete-agent-profile.dto';
import { UpdateAgentDocumentsDto } from './dto/update-agent-documents.dto';
import { AddInternationalAgentRateDto } from './dto/add-international-agent-rate.dto';
import { AddLocalAgentRateDto } from './dto/add-local-agent-rate.dto';
import { UpdateInternationalAgentRateDto } from './dto/update-international-agent-rate.dto';
import { UpdateLocalAgentRateDto } from './dto/update-local-agent-rate.dto';
import { AddContraAgentRateDto } from './dto/add-contra-agent-rate.dto';
import { UpdateContraAgentRateDto } from './dto/update-contra-agent-rate.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { EncryptionService } from '../../core/encryption/encryption.service';
import { Role } from '../../common/decorators/roles.decorator';
import {
  AgentRateLineResponse,
  AgentProfileResponse,
  UserResponse,
} from './types/user-response.types';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { AgentProfile, AgentRateLine, AgentStatus } from './entities/agent-profile.schema';
import { ShipmentRateKind } from '../shipment/entities/shipment.entity';
import { ListAgentsQueryDto } from './dto/list-agents-query.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private encryptionService: EncryptionService,
  ) {}

  async create(createUserDto: CreateUserDto, role: Role = Role.User) {
    const existing = await this.userModel.findOne({ email: createUserDto.email });
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    const passwordHash = await this.encryptionService.hash(createUserDto.password);
    const user = new this.userModel({
      name: createUserDto.name,
      email: createUserDto.email.toLowerCase(),
      passwordHash,
      role,
      isEmailVerified: role === Role.Admin,
      ...(role === Role.Agent
        ? { agentProfile: { status: AgentStatus.PendingReview, rates: [] } }
        : {}),
    });
    const saved = await user.save();
    return this.toUserResponse(saved);
  }

  /** Step 2: authenticated agent completes company profile. */
  async completeAgentProfile(agentId: string, dto: CompleteAgentProfileDto) {
    const user = await this.userModel.findById(agentId).exec();
    if (!user || user.role !== Role.Agent) {
      throw new ForbiddenException('Only agents can complete this profile');
    }
    this.hydrateAgentProfileFromLegacy(user);
    if (!user.agentProfile) {
      throw new ForbiddenException('Agent profile not initialized');
    }
    const dtoExt = dto as CompleteAgentProfileDto & {
      agencyProfile?: Record<string, unknown>;
    };
    const nestedLogo =
      typeof dtoExt.agencyProfile?.agencyLogo === 'string'
        ? dtoExt.agencyProfile.agencyLogo.trim()
        : '';
    const flatLogo = typeof dto.agencyLogo === 'string' ? dto.agencyLogo.trim() : '';
    const incomingLogo = flatLogo || nestedLogo;
    const dateEstablished = new Date(dto.dateEstablished);
    const prevSub = user.agentProfile as AgentProfile & {
      toObject?: () => Record<string, unknown>;
    };
    const prevPlain: Record<string, unknown> =
      typeof prevSub.toObject === 'function'
        ? prevSub.toObject()
        : { ...(prevSub as Record<string, unknown>) };
    /** Prefer live `documentUrls` — `toObject()` can omit them; completing profile must not wipe uploaded docs. */
    const fromLive = Array.isArray(user.agentProfile.documentUrls)
      ? [...user.agentProfile.documentUrls]
      : [];
    const fromPlain = Array.isArray(prevPlain.documentUrls)
      ? [...(prevPlain.documentUrls as string[])]
      : [];
    const mergedDocumentUrls =
      dto.documentUrls !== undefined
        ? dto.documentUrls
        : incomingLogo
          ? [incomingLogo]
          : fromLive.length > 0
            ? fromLive
            : fromPlain;
    const agencyLogo =
      incomingLogo ||
      (mergedDocumentUrls.length > 0 ? mergedDocumentUrls[0] : '') ||
      (typeof prevPlain.agencyLogo === 'string' ? prevPlain.agencyLogo.trim() : '') ||
      '';
    user.agentProfile = {
      ...prevPlain,
      status: (prevPlain.status as AgentStatus | undefined) ?? AgentStatus.PendingReview,
      pricingPlan: dto.pricingPlan,
      companyName: dto.companyName,
      dateEstablished,
      location: dto.location,
      aboutCompany: dto.aboutCompany,
      transportModes: dto.transportModes,
      isVerified: (prevPlain.isVerified as boolean | undefined) ?? false,
      documentUrls: mergedDocumentUrls,
      ...(agencyLogo ? { agencyLogo } : {}),
      rates: (prevPlain.rates as AgentProfile['rates'] | undefined) ?? [],
      ...(dto.contraPrice !== undefined
        ? { contraPrice: dto.contraPrice }
        : prevPlain.contraPrice !== undefined
          ? { contraPrice: prevPlain.contraPrice as number }
          : {}),
    } as AgentProfile;
    this.syncLegacyAgencyProfile(user);
    user.isEmailVerified = true;
    await user.save();
    return this.toUserResponse(user);
  }

  /** Set or replace `agentProfile.documentUrls` (upload returns URLs; this persists them). */
  async updateAgentDocumentUrls(agentId: string, dto: UpdateAgentDocumentsDto) {
    const user = await this.userModel.findById(agentId).exec();
    if (!user || user.role !== Role.Agent) {
      throw new ForbiddenException('Only agents can update document URLs');
    }
    if (!user.agentProfile) {
      throw new ForbiddenException('Agent profile not initialized');
    }
    user.agentProfile.documentUrls = dto.documentUrls;
    user.agentProfile.agencyLogo = dto.documentUrls[0] ?? '';
    user.markModified('agentProfile');
    this.syncLegacyAgencyProfile(user);
    await user.save();
    return this.toUserResponse(user);
  }

  async addAgentLocalRate(agentId: string, dto: AddLocalAgentRateDto) {
    const user = await this.loadAgentWithProfile(agentId);
    const line: AgentRateLine = {
      type: ShipmentRateKind.Local,
      originZone: dto.originZone,
      destinationZone: dto.destinationZone,
      ...(dto.basicPrice !== undefined ? { basicPrice: dto.basicPrice } : {}),
      price: dto.price,
    };
    user.agentProfile!.rates = [...(user.agentProfile!.rates ?? []), line];
    await user.save();
    const created = user.agentProfile!.rates![user.agentProfile!.rates!.length - 1];
    return { rate: this.mapAgentRateLine(created) };
  }

  async addAgentInternationalRate(agentId: string, dto: AddInternationalAgentRateDto) {
    const user = await this.loadAgentWithProfile(agentId);
    const line: AgentRateLine = {
      type: ShipmentRateKind.International,
      originCountry: dto.originCountry,
      destinationCountry: dto.destinationCountry,
      ...(dto.basicPrice !== undefined ? { basicPrice: dto.basicPrice } : {}),
      price: dto.price,
    };
    user.agentProfile!.rates = [...(user.agentProfile!.rates ?? []), line];
    await user.save();
    const created = user.agentProfile!.rates![user.agentProfile!.rates!.length - 1];
    return { rate: this.mapAgentRateLine(created) };
  }

  async getAgentLocalRates(agentId: string): Promise<{ items: AgentRateLineResponse[] }> {
    const user = await this.loadAgentWithProfile(agentId);
    const items = (user.agentProfile!.rates ?? [])
      .filter((r) => r.type === ShipmentRateKind.Local)
      .map((r) => this.mapAgentRateLine(r));
    return { items };
  }

  async getAgentInternationalRates(agentId: string): Promise<{ items: AgentRateLineResponse[] }> {
    const user = await this.loadAgentWithProfile(agentId);
    const items = (user.agentProfile!.rates ?? [])
      .filter((r) => r.type === ShipmentRateKind.International)
      .map((r) => this.mapAgentRateLine(r));
    return { items };
  }

  async updateAgentLocalRate(agentId: string, rateId: string, dto: UpdateLocalAgentRateDto) {
    const user = await this.loadAgentWithProfile(agentId);
    const sub = this.findRateSubdoc(user, rateId);
    if (sub.type !== ShipmentRateKind.Local) {
      throw new BadRequestException('This rate is not a local rate');
    }
    if (dto.originZone !== undefined) sub.originZone = dto.originZone;
    if (dto.destinationZone !== undefined) sub.destinationZone = dto.destinationZone;
    if (dto.basicPrice !== undefined) sub.basicPrice = dto.basicPrice;
    if (dto.price !== undefined) sub.price = dto.price;
    await user.save();
    const updated = this.findRateSubdoc(user, rateId);
    return { rate: this.mapAgentRateLine(updated) };
  }

  async updateAgentInternationalRate(
    agentId: string,
    rateId: string,
    dto: UpdateInternationalAgentRateDto,
  ) {
    const user = await this.loadAgentWithProfile(agentId);
    const sub = this.findRateSubdoc(user, rateId);
    if (sub.type !== ShipmentRateKind.International) {
      throw new BadRequestException('This rate is not an international rate');
    }
    if (dto.originCountry !== undefined) sub.originCountry = dto.originCountry;
    if (dto.destinationCountry !== undefined) sub.destinationCountry = dto.destinationCountry;
    if (dto.basicPrice !== undefined) sub.basicPrice = dto.basicPrice;
    if (dto.price !== undefined) sub.price = dto.price;
    await user.save();
    const updated = this.findRateSubdoc(user, rateId);
    return { rate: this.mapAgentRateLine(updated) };
  }

  async deleteAgentLocalRate(agentId: string, rateId: string) {
    const user = await this.loadAgentWithProfile(agentId);
    const sub = this.findRateSubdoc(user, rateId);
    if (sub.type !== ShipmentRateKind.Local) {
      throw new BadRequestException('This rate is not a local rate');
    }
    user.agentProfile!.rates = (user.agentProfile!.rates ?? []).filter(
      (r) => r._id?.toString() !== rateId,
    );
    await user.save();
    return { deleted: true };
  }

  async deleteAgentInternationalRate(agentId: string, rateId: string) {
    const user = await this.loadAgentWithProfile(agentId);
    const sub = this.findRateSubdoc(user, rateId);
    if (sub.type !== ShipmentRateKind.International) {
      throw new BadRequestException('This rate is not an international rate');
    }
    user.agentProfile!.rates = (user.agentProfile!.rates ?? []).filter(
      (r) => r._id?.toString() !== rateId,
    );
    await user.save();
    return { deleted: true };
  }

  async addAgentContraRate(agentId: string, dto: AddContraAgentRateDto) {
    const user = await this.loadAgentWithProfile(agentId);
    const line: AgentRateLine = {
      type: ShipmentRateKind.Contra,
      ...(dto.basicPrice !== undefined ? { basicPrice: dto.basicPrice } : {}),
      price: dto.price,
    };
    user.agentProfile!.rates = [...(user.agentProfile!.rates ?? []), line];
    await user.save();
    const created = user.agentProfile!.rates![user.agentProfile!.rates!.length - 1];
    return { rate: this.mapAgentRateLine(created) };
  }

  async getAgentContraRates(agentId: string): Promise<{ items: AgentRateLineResponse[] }> {
    const user = await this.loadAgentWithProfile(agentId);
    const items = (user.agentProfile!.rates ?? [])
      .filter((r) => r.type === ShipmentRateKind.Contra)
      .map((r) => this.mapAgentRateLine(r));
    return { items };
  }

  async updateAgentContraRate(agentId: string, rateId: string, dto: UpdateContraAgentRateDto) {
    const user = await this.loadAgentWithProfile(agentId);
    const sub = this.findRateSubdoc(user, rateId);
    if (sub.type !== ShipmentRateKind.Contra) {
      throw new BadRequestException('This rate is not a contra rate');
    }
    if (dto.basicPrice !== undefined) sub.basicPrice = dto.basicPrice;
    if (dto.price !== undefined) sub.price = dto.price;
    await user.save();
    const updated = this.findRateSubdoc(user, rateId);
    return { rate: this.mapAgentRateLine(updated) };
  }

  async deleteAgentContraRate(agentId: string, rateId: string) {
    const user = await this.loadAgentWithProfile(agentId);
    const sub = this.findRateSubdoc(user, rateId);
    if (sub.type !== ShipmentRateKind.Contra) {
      throw new BadRequestException('This rate is not a contra rate');
    }
    user.agentProfile!.rates = (user.agentProfile!.rates ?? []).filter(
      (r) => r._id?.toString() !== rateId,
    );
    await user.save();
    return { deleted: true };
  }

  async setAgentContraPrice(agentId: string, contraPrice: number) {
    const user = await this.loadAgentWithProfile(agentId);
    user.agentProfile!.contraPrice = contraPrice;
    await user.save();
    return this.toUserResponse(user);
  }

  async clearAgentContraPrice(agentId: string) {
    const user = await this.loadAgentWithProfile(agentId);
    user.agentProfile!.contraPrice = undefined;
    await user.save();
    return this.toUserResponse(user);
  }

  private async loadAgentWithProfile(agentId: string): Promise<UserDocument> {
    const user = await this.userModel.findById(agentId).exec();
    if (!user || user.role !== Role.Agent) {
      throw new ForbiddenException('Only agents can manage profile rates');
    }
    this.hydrateAgentProfileFromLegacy(user);
    if (!user.agentProfile) {
      throw new ForbiddenException('Agent profile not initialized');
    }
    return user;
  }

  /** If Mongo only has legacy `agencyProfile` (no typed `agentProfile`), build one so API can update it. */
  private hydrateAgentProfileFromLegacy(user: UserDocument): void {
    if (user.agentProfile) {
      return;
    }
    const legacy = (user as UserDocument & { agencyProfile?: Record<string, unknown> })
      .agencyProfile;
    if (!legacy || typeof legacy !== 'object') {
      return;
    }
    user.agentProfile = this.mapLegacyAgencyToProfileShape(legacy) as AgentProfile;
    user.markModified('agentProfile');
  }

  private mapLegacyAgencyToProfileShape(legacy: Record<string, unknown>): AgentProfile {
    const logo = typeof legacy.agencyLogo === 'string' ? legacy.agencyLogo.trim() : '';
    const rawUrls = legacy.documentUrls;
    const urls =
      Array.isArray(rawUrls) && rawUrls.length
        ? rawUrls.map((u) => String(u)).filter((s) => s.length > 0)
        : logo
          ? [logo]
          : [];
    return {
      status: AgentStatus.PendingReview,
      rates: [],
      documentUrls: urls,
      ...(logo || urls[0] ? { agencyLogo: logo || urls[0] } : {}),
      ...(typeof legacy.companyName === 'string' ? { companyName: legacy.companyName } : {}),
      ...(typeof legacy.location === 'string' ? { location: legacy.location } : {}),
      ...(typeof legacy.aboutCompany === 'string' ? { aboutCompany: legacy.aboutCompany } : {}),
    } as AgentProfile;
  }

  /** Mirror typed profile into `agencyProfile` so Atlas / legacy clients see `agencyLogo` and URLs. */
  private syncLegacyAgencyProfile(user: UserDocument): void {
    if (!user.agentProfile) {
      return;
    }
    const ap = this.agentProfileToPlain(user.agentProfile);
    const urls = Array.isArray(ap.documentUrls) ? [...ap.documentUrls] : [];
    const logo =
      typeof ap.agencyLogo === 'string' && ap.agencyLogo.trim()
        ? ap.agencyLogo.trim()
        : urls[0] || '';
    const prev = (user as UserDocument & { agencyProfile?: Record<string, unknown> }).agencyProfile;
    const prevObj = prev && typeof prev === 'object' ? { ...prev } : {};
    user.set('agencyProfile', {
      ...prevObj,
      agencyLogo: logo,
      documentUrls: urls,
    });
    user.markModified('agencyProfile');
  }

  private mergeAgentProfileSources(
    user: UserDocument,
  ): AgentProfile | Record<string, unknown> | undefined {
    const typed = user.agentProfile;
    const legacy = (user as UserDocument & { agencyProfile?: Record<string, unknown> }).agencyProfile;
    if (typed && legacy) {
      const tp = this.agentProfileToPlain(typed as AgentProfile);
      const legUrls = (legacy as { documentUrls?: unknown }).documentUrls;
      const mergedUrls =
        Array.isArray(tp.documentUrls) && tp.documentUrls.length
          ? tp.documentUrls
          : Array.isArray(legUrls)
            ? legUrls.map((u) => String(u))
            : [];
      return { ...legacy, ...tp, documentUrls: mergedUrls };
    }
    if (typed) {
      return typed as AgentProfile;
    }
    if (legacy && typeof legacy === 'object') {
      return this.mapLegacyAgencyToProfileShape(legacy);
    }
    return undefined;
  }

  private mergeLeanAgentProfiles(
    doc: Record<string, unknown>,
  ): AgentProfile | Record<string, unknown> | undefined {
    const typed = doc.agentProfile;
    const legacy = doc.agencyProfile;
    if (typed && legacy) {
      const tp = typed as AgentProfile;
      const leg = legacy as Record<string, unknown>;
      const legUrls = leg.documentUrls;
      const mergedUrls =
        Array.isArray(tp.documentUrls) && tp.documentUrls.length
          ? tp.documentUrls
          : Array.isArray(legUrls)
            ? legUrls.map((u) => String(u))
            : [];
      return { ...leg, ...this.agentProfileToPlain(tp), documentUrls: mergedUrls };
    }
    if (typed) {
      return typed as AgentProfile;
    }
    if (legacy && typeof legacy === 'object') {
      return this.mapLegacyAgencyToProfileShape(legacy as Record<string, unknown>);
    }
    return undefined;
  }

  private findRateSubdoc(user: UserDocument, rateId: string): AgentRateLine {
    if (!Types.ObjectId.isValid(rateId)) {
      throw new BadRequestException('Invalid rate id');
    }
    const rates = user.agentProfile?.rates ?? [];
    const sub = rates.find((r) => r._id?.toString() === rateId);
    if (!sub) {
      throw new NotFoundException('Rate not found');
    }
    return sub;
  }

  private mapAgentRateLine(r: AgentRateLine): AgentRateLineResponse {
    const id = r._id;
    let type: AgentRateLineResponse['type'] = 'contra';
    if (r.type === ShipmentRateKind.Local) type = 'local';
    else if (r.type === ShipmentRateKind.International) type = 'international';
    return {
      id: id ? String(id) : '',
      type,
      originZone: r.originZone,
      destinationZone: r.destinationZone,
      originCountry: r.originCountry,
      destinationCountry: r.destinationCountry,
      basicPrice: r.basicPrice,
      price: r.price,
    };
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() });
  }

  async findById(id: string) {
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.toUserResponse(user);
  }

  /**
   * Ensures the user is an agent allowed to operate (quotes, rates).
   * Blocks pending review, declined, and inactive agent accounts.
   */
  async assertAgentCanOperate(agentId: string): Promise<void> {
    const user = await this.userModel.findById(agentId).exec();
    if (!user || user.role !== Role.Agent) {
      throw new ForbiddenException('Only agents can perform this action');
    }
    this.hydrateAgentProfileFromLegacy(user);
    const st = user.agentProfile?.status;
    if (
      st === AgentStatus.PendingReview ||
      st === AgentStatus.Declined ||
      st === AgentStatus.Inactive
    ) {
      throw new ForbiddenException('Agent account is not active');
    }
  }

  async setPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<UserDocument> {
    return this.userModel
      .findByIdAndUpdate(userId, {
        passwordResetToken: token,
        resetUrlToken: token,
        passwordResetExpires: expiresAt,
      })
      .exec() as Promise<UserDocument>;
  }

  async findByResetToken(token: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({
        passwordResetToken: token,
        passwordResetExpires: { $gt: new Date() },
      })
      .exec();
  }

  /** Reset link with `uid` + `reset` query params (see `resetUrlToken` on user). */
  async findByResetUrlParams(uid: string, reset: string): Promise<UserDocument | null> {
    if (!Types.ObjectId.isValid(uid)) {
      return null;
    }
    return this.userModel
      .findOne({
        _id: new Types.ObjectId(uid),
        resetUrlToken: reset,
        passwordResetExpires: { $gt: new Date() },
      })
      .exec();
  }

  async resetPassword(userId: string, newPassword: string): Promise<void> {
    const hash = await this.encryptionService.hash(newPassword);
    await this.userModel
      .findByIdAndUpdate(userId, {
        passwordHash: hash,
        passwordResetToken: undefined,
        resetUrlToken: undefined,
        passwordResetExpires: undefined,
      })
      .exec();
  }

  async setEmailVerificationToken(
    userId: string,
    otp: string,
    expiresAt: Date,
  ): Promise<UserDocument> {
    return this.userModel
      .findByIdAndUpdate(userId, {
        emailVerificationToken: otp,
        emailVerificationExpires: expiresAt,
      })
      .exec() as Promise<UserDocument>;
  }

  async findByEmailAndVerificationOtp(
    email: string,
    otp: string,
  ): Promise<UserDocument | null> {
    return this.userModel
      .findOne({
        email: email.toLowerCase(),
        emailVerificationToken: otp,
        emailVerificationExpires: { $gt: new Date() },
      })
      .exec();
  }

  async markEmailVerified(userId: string): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(userId, {
        isEmailVerified: true,
        emailVerificationToken: undefined,
        emailVerificationExpires: undefined,
      })
      .exec();
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.userModel
      .findByIdAndUpdate(userId, { $set: dto }, { new: true })
      .exec();
    if (!user) throw new NotFoundException('User not found');
    return this.toUserResponse(user);
  }

  async updateSettings(userId: string, dto: UpdateSettingsDto) {
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException('User not found');
    const current = user.settings || {};
    user.settings = { ...current, ...dto } as User['settings'];
    await user.save();
    return this.toUserResponse(user);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException('User not found');
    const valid = await this.encryptionService.verify(user.passwordHash, currentPassword);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');
    const hash = await this.encryptionService.hash(newPassword);
    await this.userModel.findByIdAndUpdate(userId, { passwordHash: hash }).exec();
  }

  /**
   * Public directory: approved/active agents, or pending agents who finished
   * onboarding (isEmailVerified + company profile). Excludes declined/inactive.
   */
  async listPublicAgents(query: ListAgentsQueryDto) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const and: Record<string, unknown>[] = [
      {
        $or: [
          {
            'agentProfile.status': {
              $in: [AgentStatus.Approved, AgentStatus.Active],
            },
          },
          {
            isEmailVerified: true,
            'agentProfile.companyName': { $exists: true, $ne: '' },
            'agentProfile.status': AgentStatus.PendingReview,
          },
        ],
      },
    ];

    if (query.transportMode) {
      and.push({ 'agentProfile.transportModes': query.transportMode });
    }
    if (query.search) {
      const r = new RegExp(escapeRegexForAgentList(query.search), 'i');
      and.push({
        $or: [
          { name: r },
          { 'agentProfile.companyName': r },
          { 'agentProfile.location': r },
        ],
      });
    }

    const match: Record<string, unknown> = {
      role: Role.Agent,
      $and: and,
    };

    const [rawItems, total] = await Promise.all([
      this.userModel
        .find(match)
        .select('name agentProfile agencyProfile createdAt isEmailVerified')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.userModel.countDocuments(match),
    ]);

    const items = rawItems.map((doc) => {
      const d = doc as typeof doc & { createdAt?: Date; isEmailVerified?: boolean };
      const row = doc as unknown as Record<string, unknown>;
      return {
        id: String(doc._id),
        name: doc.name,
        agentProfile: this.toAgentProfileResponse(this.mergeLeanAgentProfiles(row)),
        isEmailVerified: d.isEmailVerified,
        createdAt: d.createdAt,
      };
    });

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

  /** Public: one agent by id (includes `agentProfile.documentUrls` for clients that need to fetch links). */
  async getPublicAgentById(agentId: string) {
    if (!Types.ObjectId.isValid(agentId)) {
      throw new NotFoundException('Agent not found');
    }
    const doc = await this.userModel.findById(agentId).lean().exec();
    if (!doc || doc.role !== Role.Agent) {
      throw new NotFoundException('Agent not found');
    }
    const d = doc as typeof doc & { createdAt?: Date; isEmailVerified?: boolean };
    const row = doc as unknown as Record<string, unknown>;
    return {
      id: String(doc._id),
      name: doc.name,
      agentProfile: this.toAgentProfileResponse(this.mergeLeanAgentProfiles(row)),
      isEmailVerified: d.isEmailVerified,
      createdAt: d.createdAt,
    };
  }

  async findAll(pagination: PaginationDto, role?: Role) {
    const { page = 1, limit = 10 } = pagination;
    const query = role ? { role } : {};
    const [items, total] = await Promise.all([
      this.userModel
        .find(query)
        .select('-passwordHash -passwordResetToken -resetUrlToken -emailVerificationToken -refreshToken')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.userModel.countDocuments(query),
    ]);
    return {
      items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /** Mongoose subdocuments need `toObject()` for reliable reads (e.g. `documentUrls`). */
  private agentProfileToPlain(
    ap: AgentProfile & { toObject?: (opts?: Record<string, unknown>) => AgentProfile },
  ): AgentProfile {
    if (ap && typeof ap.toObject === 'function') {
      return ap.toObject({ virtuals: false });
    }
    return ap;
  }

  /**
   * Single serialization path for agent profiles (authenticated `toUserResponse`, public directory, GET /agents/:id).
   * Accepts hydrated subdocs or lean plain objects.
   */
  toAgentProfileResponse(
    apInput: AgentProfile | Record<string, unknown> | null | undefined,
  ): AgentProfileResponse | undefined {
    if (!apInput) {
      return undefined;
    }
    const ap =
      apInput &&
      typeof apInput === 'object' &&
      'toObject' in apInput &&
      typeof (apInput as { toObject?: unknown }).toObject === 'function'
        ? this.agentProfileToPlain(apInput as AgentProfile)
        : (apInput as AgentProfile);
    const rawUrls = ap.documentUrls ?? (apInput as Record<string, unknown>)['document_urls'];
    const documentUrls = Array.isArray(rawUrls)
      ? rawUrls.map((u) => String(u)).filter((s) => s.length > 0)
      : [];
    const logoFromAp =
      typeof (ap as AgentProfile).agencyLogo === 'string'
        ? (ap as AgentProfile).agencyLogo!.trim()
        : '';
    const legacyLogo =
      typeof (apInput as Record<string, unknown>).agencyLogo === 'string'
        ? String((apInput as Record<string, unknown>).agencyLogo).trim()
        : '';
    const agencyLogo = logoFromAp || legacyLogo || documentUrls[0] || undefined;
    return {
      pricingPlan: ap.pricingPlan,
      companyName: ap.companyName,
      dateEstablished: ap.dateEstablished
        ? new Date(ap.dateEstablished as Date).toISOString()
        : undefined,
      location: ap.location,
      aboutCompany: ap.aboutCompany,
      transportModes: ap.transportModes,
      isVerified: ap.isVerified,
      logisticsId: ap.logisticsId,
      trucksCount: ap.trucksCount,
      loadCapacity: ap.loadCapacity,
      status: ap.status,
      documentUrls,
      ...(agencyLogo ? { agencyLogo } : {}),
      rates: Array.isArray(ap.rates)
        ? ap.rates.map((r) => this.mapAgentRateLine(r as AgentRateLine))
        : [],
      contraPrice: ap.contraPrice,
      category: ap.category,
    };
  }

  toUserResponse(user: UserDocument): UserResponse {
    const base: UserResponse = {
      id: String(user._id ?? (user as { id?: string }).id),
      name: user.name,
      email: user.email,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      phone: user.phone,
      address: user.address,
      city: user.city,
      state: user.state,
      zipCode: user.zipCode,
      country: user.country,
      avatarUrl: user.avatarUrl,
      settings: user.settings,
    };
    const merged = this.mergeAgentProfileSources(user);
    if (merged) {
      const agentProfile = this.toAgentProfileResponse(merged);
      return agentProfile ? { ...base, agentProfile } : base;
    }
    return base;
  }
}

function escapeRegexForAgentList(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
