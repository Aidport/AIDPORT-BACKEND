import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { LoginDto } from '../user/dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { EncryptionService } from '../../core/encryption/encryption.service';
import { Role } from '../../common/decorators/roles.decorator';
import { UserResponse } from '../user/types/user-response.types';
import { EmailService } from '../../integrations/email/email.service';
import { PasswordResetMail } from '../../integrations/email/mails/password-reset.mail';
import { VerificationMail } from '../../integrations/email/mails/verification.mail';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private encryptionService: EncryptionService,
    private jwtService: JwtService,
    private emailService: EmailService,
  ) {}

  async signUp(createUserDto: CreateUserDto, role: Role = Role.User): Promise<{ user: UserResponse } & { accessToken: string; expiresIn: string }> {
    const user = await this.userService.create(createUserDto, role) as UserResponse;
    const token = this.generateToken(user.id, user.role);
    return { user, ...token };
  }

  async signUpAgent(createUserDto: CreateUserDto) {
    return this.signUp(createUserDto, Role.Agent);
  }

  async signUpAdmin(createUserDto: CreateUserDto) {
    return this.signUp(createUserDto, Role.Admin);
  }

  async login(loginDto: LoginDto) {
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
    const userResponse = this.userService.toUserResponse(user);
    const token = this.generateToken(userResponse.id, userResponse.role);
    return { user: userResponse, ...token };
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
    const mail = new PasswordResetMail(
      user.email,
      user.name,
      token,
      this.emailService,
    );
    await mail.sendPasswordResetEmail();
    return { message: 'If the email exists, a reset link has been sent.' };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const user = await this.userService.findByResetToken(dto.token);
    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }
    await this.userService.resetPassword(String(user._id), dto.newPassword);
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

  async resendVerification(dto: ResendVerificationDto): Promise<{ message: string }> {
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
    const mail = new VerificationMail(
      user.email,
      user.name,
      otp,
      this.emailService,
    );
    await mail.sendVerificationEmail();
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
