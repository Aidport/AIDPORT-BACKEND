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
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { EncryptionService } from '../../core/encryption/encryption.service';
import { Role } from '../../common/decorators/roles.decorator';
import { UserResponse } from './types/user-response.types';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { AgentStatus } from './entities/agent-profile.schema';

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

  toUserResponse(user: UserDocument): UserResponse {
    return {
      id: String(user._id ?? (user as { id?: string }).id),
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      address: user.address,
      city: user.city,
      state: user.state,
      zipCode: user.zipCode,
      country: user.country,
      avatarUrl: user.avatarUrl,
      settings: user.settings,
    };
  }
}
