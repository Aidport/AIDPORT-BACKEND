import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { LoginDto } from '../user/dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { RequestVerificationCodeDto } from './dto/request-verification-code.dto';
import { EncryptionService } from '../../core/encryption/encryption.service';
import { Role } from '../../common/decorators/roles.decorator';
import { UserResponse } from '../user/types/user-response.types';
import { UserAccountState } from '../user/entities/user-account-state.enum';
import { EmailService } from '../../integrations/email/email.service';

/** Optional request metadata for login notification emails. */
export type LoginClientMeta = {
  ip?: string;
  userAgent?: string;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private userService: UserService,
    private encryptionService: EncryptionService,
    private jwtService: JwtService,
    private emailService: EmailService,
  ) {}

  /** Logs transport errors (`[email]` prefix) and throws HTTP 503. Login notification is excluded — it logs only so login still succeeds. */
  private async requireEmailSent<T>(
    send: () => Promise<T>,
    logContext: string,
    clientMessage: string,
  ): Promise<T> {
    try {
      return await send();
    } catch (err) {
      this.logger.error(
        `[email] ${logContext}: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err.stack : undefined,
      );
      throw new ServiceUnavailableException(clientMessage);
    }
  }

  async signUp(createUserDto: CreateUserDto, role: Role = Role.User): Promise<{ user: UserResponse } & { accessToken: string; expiresIn: string }> {
    const user = (await this.userService.create(createUserDto, role)) as UserResponse;
    const token = this.generateToken(user.id, user.role);
    if (this.emailService.isConfigured() && role !== Role.Admin) {
      const otp = randomBytes(4).toString('hex').toUpperCase();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      await this.userService.setEmailVerificationToken(user.id, otp, expiresAt);
      await this.requireEmailSent(
        () =>
          this.emailService.sendVerificationEmail(user.email, user.name, otp, 'signup'),
        `Signup verification email failed for ${user.email}`,
        'Unable to send verification email. Please try again or use resend verification.',
      );
    }
    return { user, ...token };
  }

  async signUpAgent(createUserDto: CreateUserDto) {
    const user = (await this.userService.create(createUserDto, Role.Agent)) as UserResponse;
    const token = this.generateToken(user.id, user.role);
    if (this.emailService.isConfigured()) {
      const otp = randomBytes(4).toString('hex').toUpperCase();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      await this.userService.setEmailVerificationToken(user.id, otp, expiresAt);
      await this.requireEmailSent(
        () =>
          this.emailService.sendVerificationEmail(user.email, user.name, otp, 'signup'),
        `Agent signup verification email failed for ${user.email}`,
        'Unable to send verification email. Please try again or use resend verification.',
      );
    }
    return { user, ...token };
  }

  async signUpAdmin(createUserDto: CreateUserDto) {
    return this.signUp(createUserDto, Role.Admin);
  }

  async login(loginDto: LoginDto, clientMeta?: LoginClientMeta) {
    const user = await this.userService.findByEmail(loginDto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const valid = await this.encryptionService.verify(
      user.passwordHash,
      loginDto.password,
    );
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const accountState = user.userState ?? UserAccountState.Active;
    if (accountState === UserAccountState.Blocked) {
      throw new UnauthorizedException('This account has been blocked.');
    }
    if (accountState === UserAccountState.Suspended) {
      throw new UnauthorizedException('This account is suspended.');
    }
    if (!user.isEmailVerified && user.role !== Role.Admin) {
      throw new UnauthorizedException(
        'Please verify your email with the OTP sent to your inbox.',
      );
    }
    if (accountState === UserAccountState.Pending) {
      throw new UnauthorizedException(
        'Your account is pending approval. You will be notified when it is active.',
      );
    }
    const userResponse = this.userService.toUserResponse(user);
    const token = this.generateToken(userResponse.id, userResponse.role);
    if (this.emailService.isConfigured()) {
      const loggedInAtIso = new Date().toISOString();
      void this.emailService
        .sendLoginNotificationEmail(user.email, user.name, {
          loggedInAtIso,
          ip: clientMeta?.ip,
          userAgent: clientMeta?.userAgent,
        })
        .catch((err) => {
          this.logger.error(
            `[email] login_notification failed for ${user.email}: ${err instanceof Error ? err.message : String(err)}`,
            err instanceof Error ? err.stack : undefined,
          );
        });
    }
    return { user: userResponse, ...token };
  }

  /** Agent portal login — rejects non-agent accounts (strict RBAC). */
  async loginAgent(loginDto: LoginDto, clientMeta?: LoginClientMeta) {
    const result = await this.login(loginDto, clientMeta);
    if (result.user.role !== Role.Agent) {
      throw new ForbiddenException('Only agent accounts can sign in here');
    }
    return result;
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const user = await this.userService.findByEmail(dto.email);
    if (!user) {
      return { message: 'If the email exists, a reset link has been sent.' };
    }
    if (!this.emailService.isConfigured()) {
      throw new BadRequestException('Email service is not configured');
    }
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await this.userService.setPasswordResetToken(
      String(user._id),
      token,
      expiresAt,
    );
    await this.requireEmailSent(
      () =>
        this.emailService.sendPasswordResetEmail(
          user.email,
          user.name,
          String(user._id),
          token,
        ),
      `Password reset email failed for ${user.email}`,
      'Unable to send password reset email. Please try again later.',
    );
    return { message: 'If the email exists, a reset link has been sent.' };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const legacy = dto.token?.trim();
    const uid = dto.uid?.trim();
    const reset = dto.reset?.trim();
    const hasPair = !!(uid && reset);
    const hasLegacy = !!legacy;

    if (!hasLegacy && !hasPair) {
      throw new BadRequestException(
        'Provide either token (legacy) or uid and reset from the reset link.',
      );
    }
    if (hasLegacy && hasPair) {
      throw new BadRequestException('Provide either token or uid and reset, not both.');
    }

    let user = hasLegacy
      ? await this.userService.findByResetToken(legacy!)
      : await this.userService.findByResetUrlParams(uid!, reset!);

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }
    await this.userService.resetPassword(String(user._id), dto.newPassword);
    if (this.emailService.isConfigured()) {
      try {
        await this.emailService.sendPasswordChangedEmail(user.email, user.name);
      } catch (err) {
        this.logger.error(
          `[email] password_changed_notify failed for ${user.email}: ${err instanceof Error ? err.message : String(err)}`,
          err instanceof Error ? err.stack : undefined,
        );
      }
    }
    return { message: 'Password has been reset successfully' };
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<{ message: string }> {
    const user = await this.userService.findByEmailAndVerificationOtp(
      dto.email,
      dto.otp,
    );
    if (!user) {
      throw new BadRequestException('Invalid or expired verification code');
    }
    await this.userService.markEmailVerified(String(user._id));
    return { message: 'Email verified successfully' };
  }

  async requestVerificationCode(dto: RequestVerificationCodeDto): Promise<{ message: string }> {
    const user = await this.userService.findByEmail(dto.email);
    if (!user) {
      return { message: 'If the email exists, a verification code has been sent.' };
    }
    if (user.isEmailVerified) {
      throw new BadRequestException('Email is already verified');
    }
    if (!this.emailService.isConfigured()) {
      throw new BadRequestException('Email service is not configured');
    }
    const otp = randomBytes(4).toString('hex').toUpperCase();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await this.userService.setEmailVerificationToken(
      String(user._id),
      otp,
      expiresAt,
    );
    await this.requireEmailSent(
      () =>
        this.emailService.sendVerificationEmail(user.email, user.name, otp, 'repeat'),
      `Verification code email failed for ${dto.email}`,
      'Unable to send verification code. Please try again later.',
    );
    return { message: 'If the email exists, a verification code has been sent.' };
  }

  private generateToken(userId: string, role: string) {
    const payload = { sub: userId, role };
    const accessToken = this.jwtService.sign(payload);
    return {
      accessToken,
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    };
  }
}
