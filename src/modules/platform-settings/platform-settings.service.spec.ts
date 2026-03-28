import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { PlatformSettingsService } from './platform-settings.service';
import { PlatformSettings } from './entities/platform-settings.entity';

describe('PlatformSettingsService', () => {
  let service: PlatformSettingsService;
  let mockModel: {
    findOne: jest.Mock;
    create: jest.Mock;
    findByIdAndUpdate: jest.Mock;
  };

  beforeEach(async () => {
    mockModel = {
      findOne: jest.fn(),
      create: jest.fn(),
      findByIdAndUpdate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformSettingsService,
        {
          provide: getModelToken(PlatformSettings.name),
          useValue: mockModel,
        },
      ],
    }).compile();

    service = module.get<PlatformSettingsService>(PlatformSettingsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getOrCreate', () => {
    it('should return existing document', async () => {
      const existing = {
        _id: new Types.ObjectId(),
        platformName: 'Aidport',
      };
      mockModel.findOne.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(existing),
        }),
      });

      const doc = await service.getOrCreate();
      expect(doc).toBe(existing);
      expect(mockModel.create).not.toHaveBeenCalled();
    });

    it('should create when none exists', async () => {
      const created = {
        _id: new Types.ObjectId(),
        platformName: 'Aidport',
      };
      mockModel.findOne.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      });
      mockModel.create.mockResolvedValue(created);

      const doc = await service.getOrCreate();
      expect(mockModel.create).toHaveBeenCalledWith({
        platformName: 'Aidport',
        notifyNewSystemUpdates: true,
        notifyNewShipment: true,
        notifyVerificationUpdate: true,
      });
      expect(doc).toBe(created);
    });
  });

  describe('update', () => {
    it('should patch and return updated doc', async () => {
      const id = new Types.ObjectId();
      mockModel.findOne.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({ _id: id, platformName: 'Aidport' }),
        }),
      });
      const updated = {
        _id: id,
        platformName: 'NewName',
        adminEmail: 'a@example.com',
      };
      mockModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(updated),
      });

      const result = await service.update({
        platformName: 'NewName',
        adminEmail: 'a@example.com',
      });
      expect(mockModel.findByIdAndUpdate).toHaveBeenCalledWith(
        id,
        {
          $set: {
            platformName: 'NewName',
            adminEmail: 'a@example.com',
          },
        },
        { new: true },
      );
      expect(result).toBe(updated);
    });
  });
});
