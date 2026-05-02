import { Test, TestingModule } from '@nestjs/testing';
import {
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { EncryptionService } from '../../core/encryption/encryption.service';
import { EmailService } from '../../integrations/email/email.service';
import { Role } from '../../common/decorators/roles.decorator';

describe('AuthService', () => {
  let service: AuthService;
  let userService: UserService;
  let encryptionService: EncryptionService;
  let emailService: EmailService;

  const mockUser = {
    id: 'userId123',
    name: 'Test User',
    email: 'test@example.com',
    role: Role.User,
  };

  const mockUserDocument = {
    _id: { toString: () => 'userId123' },
    name: 'Test User',
    email: 'test@example.com',
    role: Role.User,
    passwordHash: 'hashed',
    isEmailVerified: true,
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserService,
          useValue: {
            create: jest.fn().mockResolvedValue(mockUser),
            findByEmail: jest.fn(),
            findByResetToken: jest.fn(),
            findByResetUrlParams: jest.fn(),
            findByEmailAndVerificationOtp: jest.fn(),
            setPasswordResetToken: jest.fn(),
            setEmailVerificationToken: jest.fn(),
            resetPassword: jest.fn(),
            markEmailVerified: jest.fn(),
            toUserResponse: jest.fn().mockReturnValue(mockUser),
          },
        },
        {
          provide: EncryptionService,
          useValue: {
            hash: jest.fn().mockResolvedValue('hashedPassword'),
            verify: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mockJwtToken'),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) =>
              key === 'JWT_EXPIRES_IN' ? '7d' : undefined,
            ),
          },
        },
        {
          provide: EmailService,
          useValue: {
            isConfigured: jest.fn().mockReturnValue(true),
            sendMail: jest.fn().mockResolvedValue(undefined),
            sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
            sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
            sendPasswordChangedEmail: jest.fn().mockResolvedValue(undefined),
            sendShipmentInvoiceEmail: jest.fn().mockResolvedValue(undefined),
            sendLoginNotificationEmail: jest.fn().mockResolvedValue(undefined),
            sendShipmentAssignedToAgentEmail: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userService = module.get<UserService>(UserService);
    encryptionService = module.get<EncryptionService>(EncryptionService);
    emailService = module.get<EmailService>(EmailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('signUp', () => {
    it('should register a new user and return token', async () => {
      const dto = { name: 'Test', email: 'test@example.com', password: 'pass123' };
      const result = await service.signUp(dto);
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('expiresIn');
      expect(userService.create).toHaveBeenCalledWith(dto, Role.User);
      expect(userService.setEmailVerificationToken).toHaveBeenCalled();
      expect(emailService.sendVerificationEmail).toHaveBeenCalled();
    });

    it('should reject when verification email fails to send', async () => {
      jest.spyOn(emailService, 'sendVerificationEmail').mockRejectedValue(new Error('SMTP down'));
      await expect(service.signUp({ name: 'Test', email: 'test@example.com', password: 'pass123' })).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('signUpAgent', () => {
    it('should register an agent (role agent)', async () => {
      const dto = { name: 'Agent', email: 'agent@example.com', password: 'pass123' };
      const result = await service.signUpAgent(dto);
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken');
      expect(userService.create).toHaveBeenCalledWith(dto, Role.Agent);
      expect(userService.setEmailVerificationToken).toHaveBeenCalled();
      expect(emailService.sendVerificationEmail).toHaveBeenCalled();
    });

    it('should reject when verification email fails to send', async () => {
      jest.spyOn(emailService, 'sendVerificationEmail').mockRejectedValue(new Error('SMTP down'));
      await expect(service.signUpAgent({ name: 'Agent', email: 'agent@example.com', password: 'pass123' })).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('login', () => {
    it('should login with valid credentials', async () => {
      jest.spyOn(userService, 'findByEmail').mockResolvedValue(mockUserDocument as any);
      const result = await service.login({
        email: 'test@example.com',
        password: 'correct',
      });
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('user');
      expect(emailService.sendLoginNotificationEmail).toHaveBeenCalled();
    });

    it('should still login when notification email fails (failure is logged only)', async () => {
      jest.spyOn(userService, 'findByEmail').mockResolvedValue(mockUserDocument as any);
      jest.spyOn(emailService, 'sendLoginNotificationEmail').mockRejectedValue(new Error('SMTP down'));
      const result = await service.login({
        email: 'test@example.com',
        password: 'correct',
      });
      expect(result).toHaveProperty('accessToken');
      expect(emailService.sendLoginNotificationEmail).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for invalid email', async () => {
      jest.spyOn(userService, 'findByEmail').mockResolvedValue(null);
      await expect(
        service.login({ email: 'nonexistent@example.com', password: 'pass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      jest.spyOn(userService, 'findByEmail').mockResolvedValue(mockUserDocument as any);
      jest.spyOn(encryptionService, 'verify').mockResolvedValue(false);
      await expect(
        service.login({ email: 'test@example.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('loginAgent', () => {
    it('should return token only for agent role', async () => {
      const agentDoc = { ...mockUserDocument, role: Role.Agent };
      jest.spyOn(userService, 'findByEmail').mockResolvedValue(agentDoc as any);
      jest.spyOn(encryptionService, 'verify').mockResolvedValue(true);
      jest.spyOn(userService, 'toUserResponse').mockReturnValue({
        ...mockUser,
        role: Role.Agent,
      } as any);
      const result = await service.loginAgent({
        email: 'test@example.com',
        password: 'correct',
      });
      expect(result.user.role).toBe(Role.Agent);
    });

    it('should reject non-agent accounts', async () => {
      jest.spyOn(userService, 'findByEmail').mockResolvedValue(mockUserDocument as any);
      jest.spyOn(encryptionService, 'verify').mockResolvedValue(true);
      await expect(
        service.loginAgent({ email: 'test@example.com', password: 'correct' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('forgotPassword', () => {
    it('should return message when user not found', async () => {
      jest.spyOn(userService, 'findByEmail').mockResolvedValue(null);
      const result = await service.forgotPassword({ email: 'nonexistent@example.com' });
      expect(result.message).toContain('If the email exists');
      expect(userService.setPasswordResetToken).not.toHaveBeenCalled();
    });

    it('should set token and send email when user exists', async () => {
      jest.spyOn(userService, 'findByEmail').mockResolvedValue(mockUserDocument as any);
      const result = await service.forgotPassword({ email: 'test@example.com' });
      expect(result.message).toContain('If the email exists');
      expect(userService.setPasswordResetToken).toHaveBeenCalled();
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalled();
    });

    it('should reject when reset email fails to send', async () => {
      jest.spyOn(userService, 'findByEmail').mockResolvedValue(mockUserDocument as any);
      jest.spyOn(emailService, 'sendPasswordResetEmail').mockRejectedValue(new Error('SMTP down'));
      await expect(service.forgotPassword({ email: 'test@example.com' })).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('should throw when email not configured', async () => {
      jest.spyOn(userService, 'findByEmail').mockResolvedValue(mockUserDocument as any);
      jest.spyOn(emailService, 'isConfigured').mockReturnValue(false);
      await expect(
        service.forgotPassword({ email: 'test@example.com' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('resetPassword', () => {
    it('should throw for invalid token', async () => {
      jest.spyOn(userService, 'findByResetToken').mockResolvedValue(null);
      await expect(
        service.resetPassword({ token: 'invalid', newPassword: 'newpass123' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reset password when token valid', async () => {
      jest.spyOn(userService, 'findByResetToken').mockResolvedValue(mockUserDocument as any);
      const result = await service.resetPassword({
        token: 'valid-token',
        newPassword: 'newpass123',
      });
      expect(result.message).toBe('Password has been reset successfully');
      expect(userService.resetPassword).toHaveBeenCalledWith('userId123', 'newpass123');
      expect(emailService.sendPasswordChangedEmail).toHaveBeenCalledWith(
        'test@example.com',
        'Test User',
      );
    });

    it('should reset password when uid and reset valid', async () => {
      jest.spyOn(userService, 'findByResetUrlParams').mockResolvedValue(mockUserDocument as any);
      const result = await service.resetPassword({
        uid: 'userId123',
        reset: 'opaque-segment',
        newPassword: 'newpass123',
      });
      expect(result.message).toBe('Password has been reset successfully');
      expect(userService.findByResetUrlParams).toHaveBeenCalledWith('userId123', 'opaque-segment');
      expect(userService.resetPassword).toHaveBeenCalledWith('userId123', 'newpass123');
    });

    it('should reject when neither token nor uid+reset provided', async () => {
      await expect(
        service.resetPassword({ newPassword: 'newpass123' } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('verifyEmail', () => {
    it('should throw for invalid OTP', async () => {
      jest.spyOn(userService, 'findByEmailAndVerificationOtp').mockResolvedValue(null);
      await expect(
        service.verifyEmail({ email: 'test@example.com', otp: 'wrong' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should verify email when OTP valid', async () => {
      jest.spyOn(userService, 'findByEmailAndVerificationOtp').mockResolvedValue(mockUserDocument as any);
      const result = await service.verifyEmail({
        email: 'test@example.com',
        otp: 'ABC123',
      });
      expect(result.message).toBe('Email verified successfully');
      expect(userService.markEmailVerified).toHaveBeenCalledWith('userId123');
    });
  });

  describe('requestVerificationCode', () => {
    it('should throw when email already verified', async () => {
      jest.spyOn(userService, 'findByEmail').mockResolvedValue({
        ...mockUserDocument,
        isEmailVerified: true,
      } as any);
      await expect(
        service.requestVerificationCode({ email: 'test@example.com' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should send verification when user exists and not verified', async () => {
      jest.spyOn(userService, 'findByEmail').mockResolvedValue({
        ...mockUserDocument,
        isEmailVerified: false,
      } as any);
      const result = await service.requestVerificationCode({ email: 'test@example.com' });
      expect(result.message).toContain('If the email exists');
      expect(userService.setEmailVerificationToken).toHaveBeenCalled();
      expect(emailService.sendVerificationEmail).toHaveBeenCalled();
    });

    it('should reject when verification email fails to send', async () => {
      jest.spyOn(userService, 'findByEmail').mockResolvedValue({
        ...mockUserDocument,
        isEmailVerified: false,
      } as any);
      jest.spyOn(emailService, 'sendVerificationEmail').mockRejectedValue(new Error('SMTP down'));
      await expect(service.requestVerificationCode({ email: 'test@example.com' })).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });
});
