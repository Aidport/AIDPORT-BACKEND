import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UserService } from './user.service';
import { User } from './entities/user.entity';
import { EncryptionService } from '../../core/encryption/encryption.service';
import { Role } from '../../common/decorators/roles.decorator';
import { AgentStatus } from './entities/agent-profile.schema';

describe('UserService', () => {
  let service: UserService;
  let mockUserModel: any;

  const mockUserDoc = {
    _id: { toString: () => 'userId123' },
    name: 'Test User',
    email: 'test@example.com',
    role: Role.User,
    passwordHash: 'hashed',
  };

  beforeEach(async () => {
    mockUserModel = {
      findOne: jest.fn(),
      findById: jest.fn(),
      prototype: { save: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
        {
          provide: EncryptionService,
          useValue: {
            hash: jest.fn().mockResolvedValue('hashedPassword'),
          },
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a user', async () => {
      mockUserModel.findOne = jest.fn().mockResolvedValue(null);
      const saveMock = jest.fn().mockResolvedValue(mockUserDoc);
      mockUserModel.mockImplementation = jest.fn().mockReturnValue({
        save: saveMock,
        ...mockUserDoc,
      });
      const UserModel = jest.fn().mockImplementation(function () {
        this.save = saveMock;
        Object.assign(this, mockUserDoc);
        return this;
      });
      (service as any).userModel = UserModel;
      (service as any).userModel.findOne = jest.fn().mockResolvedValue(null);

      const result = await service.create(
        { name: 'Test', email: 'test@example.com', password: 'pass' },
        Role.User,
      );
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('email');
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('should throw ConflictException when email exists', async () => {
      (service as any).userModel.findOne = jest.fn().mockResolvedValue(mockUserDoc);
      await expect(
        service.create(
          { name: 'Test', email: 'test@example.com', password: 'pass' },
          Role.User,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findById', () => {
    it('should throw NotFoundException when user not found', async () => {
      (service as any).userModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('assertAgentCanOperate', () => {
    it('should throw when user is not an agent', async () => {
      (service as any).userModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ ...mockUserDoc, role: Role.User }),
      });
      await expect(service.assertAgentCanOperate('userId123')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw when agent is pending review', async () => {
      (service as any).userModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          role: Role.Agent,
          agentProfile: { status: AgentStatus.PendingReview },
        }),
      });
      await expect(service.assertAgentCanOperate('aid')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should resolve when agent is approved', async () => {
      (service as any).userModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          role: Role.Agent,
          agentProfile: { status: AgentStatus.Approved },
        }),
      });
      await expect(service.assertAgentCanOperate('aid')).resolves.toBeUndefined();
    });
  });
});
