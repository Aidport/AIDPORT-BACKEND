import {
  Injectable,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { CompleteAgentProfileDto } from './dto/complete-agent-profile.dto';
import { UpdateAgentDocumentsDto } from './dto/update-agent-documents.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { EncryptionService } from '../../core/encryption/encryption.service';
import { Role } from '../../common/decorators/roles.decorator';
import { AgentProfileResponse, UserResponse } from './types/user-response.types';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { AgentProfile, AgentStatus } from './entities/agent-profile.schema';
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
      ...(role === Role.Agent
        ? { agentProfile: { status: AgentStatus.PendingReview } }
        : {}),
    });
    const saved = await user.save();
    return this.toUserResponse(saved);
  }

  /** Step 2: authenticated agent completes company profile. */
  async completeAgentProfile(agentId: string, dto: CompleteAgentProfileDto) {
    const user = await this.userModel.findById(agentId).exec();
    if (!user || user.role !== Role.Agent || !user.agentProfile) {
      throw new ForbiddenException('Only agents can complete this profile');
    }
    const dateEstablished = new Date(dto.dateEstablished);
    const prevSub = user.agentProfile as AgentProfile & {
      toObject?: () => Record<string, unknown>;
    };
    const prevPlain: Record<string, unknown> =
      typeof prevSub.toObject === 'function'
        ? prevSub.toObject()
        : { ...(prevSub as Record<string, unknown>) };
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
      documentUrls:
        dto.documentUrls !== undefined
          ? dto.documentUrls
          : ((prevPlain.documentUrls as string[] | undefined) ?? []),
    } as AgentProfile;
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
    await user.save();
    return this.toUserResponse(user);
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

  async resetPassword(userId: string, newPassword: string): Promise<void> {
    const hash = await this.encryptionService.hash(newPassword);
    await this.userModel
      .findByIdAndUpdate(userId, {
        passwordHash: hash,
        passwordResetToken: undefined,
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
        .select('name agentProfile createdAt isEmailVerified')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.userModel.countDocuments(match),
    ]);

    const items = rawItems.map((doc) => {
      const d = doc as typeof doc & { createdAt?: Date; isEmailVerified?: boolean };
      return {
        id: String(doc._id),
        name: doc.name,
        agentProfile: doc.agentProfile,
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

  async findAll(pagination: PaginationDto, role?: Role) {
    const { page = 1, limit = 10 } = pagination;
    const query = role ? { role } : {};
    const [items, total] = await Promise.all([
      this.userModel
        .find(query)
        .select('-passwordHash -passwordResetToken -emailVerificationToken -refreshToken')
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
    if (user.agentProfile) {
      const ap = this.agentProfileToPlain(user.agentProfile);
      const agentProfile: AgentProfileResponse = {
        pricingPlan: ap.pricingPlan,
        companyName: ap.companyName,
        dateEstablished: ap.dateEstablished
          ? new Date(ap.dateEstablished).toISOString()
          : undefined,
        location: ap.location,
        aboutCompany: ap.aboutCompany,
        transportModes: ap.transportModes,
        isVerified: ap.isVerified,
        logisticsId: ap.logisticsId,
        trucksCount: ap.trucksCount,
        loadCapacity: ap.loadCapacity,
        status: ap.status,
        documentUrls: Array.isArray(ap.documentUrls) ? [...ap.documentUrls] : ap.documentUrls,
        category: ap.category,
      };
      return { ...base, agentProfile };
    }
    return base;
  }
}

function escapeRegexForAgentList(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
