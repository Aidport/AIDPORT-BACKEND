import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { User } from '../user/entities/user.entity';
import { Shipment } from '../shipment/entities/shipment.entity';
import { UserService } from '../user/user.service';
import { ShipmentService } from '../shipment/shipment.service';
import { QuotesService } from '../quotes/quotes.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { QuoteStatus } from '../quotes/entities/quote.entity';
import { AgentStatus } from '../user/entities/agent-profile.schema';
import { Role } from '../../common/decorators/roles.decorator';

describe('AdminService', () => {
  let service: AdminService;
  let userModel: Record<string, jest.Mock>;
  let shipmentModel: Record<string, jest.Mock>;
  let quotesService: {
    findAllForAdmin: jest.Mock;
    updateStatus: jest.Mock;
    countByStatus: jest.Mock;
  };
  let platformSettingsService: {
    getOrCreate: jest.Mock;
    update: jest.Mock;
  };
  let userService: { findAll: jest.Mock; create: jest.Mock };
  let shipmentService: {
    findAll: jest.Mock;
    findForAdmin: jest.Mock;
    update: jest.Mock;
    getPlatformShipmentStats: jest.Mock;
    getShipmentStatsForShipper: jest.Mock;
    getShipmentStatsForAgent: jest.Mock;
  };

  beforeEach(async () => {
    userModel = {
      aggregate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
      countDocuments: jest.fn().mockResolvedValue(0),
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      }),
      findOne: jest.fn(),
      findById: jest.fn(),
      findOneAndUpdate: jest.fn(),
    };
    shipmentModel = {
      countDocuments: jest.fn().mockResolvedValue(0),
      aggregate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
      find: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      }),
    };

    quotesService = {
      findAllForAdmin: jest.fn().mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        limit: 20,
      }),
      updateStatus: jest.fn(),
      countByStatus: jest.fn().mockResolvedValue({
        pending: 0,
        approved: 0,
        rejected: 0,
        accepted: 0,
      }),
    };
    platformSettingsService = {
      getOrCreate: jest.fn().mockResolvedValue({ platformName: 'Aidport' }),
      update: jest.fn(),
    };
    userService = {
      findAll: jest.fn(),
      create: jest.fn(),
    };
    shipmentService = {
      findAll: jest.fn(),
      findForAdmin: jest.fn().mockResolvedValue({
        items: [],
        meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
      }),
      update: jest.fn(),
      getPlatformShipmentStats: jest.fn().mockResolvedValue({
        pending: 0,
        cancelled: 0,
        delivered: 0,
        in_transit: 0,
      }),
      getShipmentStatsForShipper: jest.fn().mockResolvedValue({
        pending: 0,
        cancelled: 0,
        delivered: 0,
        in_transit: 0,
      }),
      getShipmentStatsForAgent: jest.fn().mockResolvedValue({
        pending: 0,
        cancelled: 0,
        delivered: 0,
        in_transit: 0,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: getModelToken(Shipment.name), useValue: shipmentModel },
        { provide: UserService, useValue: userService },
        { provide: ShipmentService, useValue: shipmentService },
        { provide: QuotesService, useValue: quotesService },
        { provide: PlatformSettingsService, useValue: platformSettingsService },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getNotifications', () => {
    it('returns empty placeholder list', () => {
      expect(service.getNotifications()).toEqual({ items: [] });
    });
  });

  describe('getQuotesForAdmin', () => {
    it('delegates to QuotesService', async () => {
      await service.getQuotesForAdmin(QuoteStatus.Pending, 2, 5);
      expect(quotesService.findAllForAdmin).toHaveBeenCalledWith({
        status: QuoteStatus.Pending,
        page: 2,
        limit: 5,
      });
    });
  });

  describe('updateQuoteStatus', () => {
    it('maps approved to QuoteStatus.Approved', async () => {
      quotesService.updateStatus.mockResolvedValue({
        status: QuoteStatus.Approved,
      });
      await service.updateQuoteStatus('id1', 'approved');
      expect(quotesService.updateStatus).toHaveBeenCalledWith(
        'id1',
        QuoteStatus.Approved,
      );
    });

    it('maps rejected to QuoteStatus.Rejected', async () => {
      quotesService.updateStatus.mockResolvedValue({
        status: QuoteStatus.Rejected,
      });
      await service.updateQuoteStatus('id1', 'rejected');
      expect(quotesService.updateStatus).toHaveBeenCalledWith(
        'id1',
        QuoteStatus.Rejected,
      );
    });
  });

  describe('getPlatformSettings', () => {
    it('delegates to PlatformSettingsService', async () => {
      await service.getPlatformSettings();
      expect(platformSettingsService.getOrCreate).toHaveBeenCalled();
    });
  });

  describe('getShipmentsForAdmin', () => {
    it('resolves user search ids and calls ShipmentService.findForAdmin', async () => {
      userModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([{ _id: '507f1f77bcf86cd799439011' }]),
          }),
        }),
      });

      await service.getShipmentsForAdmin({
        page: 1,
        limit: 10,
        search: 'john',
      } as any);

      expect(shipmentService.findForAdmin).toHaveBeenCalled();
      const call = shipmentService.findForAdmin.mock.calls[0];
      expect(call[1].search).toBe('john');
      expect(call[1].userIdsForSearch).toBeDefined();
    });
  });

  describe('getAgentById', () => {
    it('throws NotFoundException when missing', async () => {
      userModel.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(null),
          }),
        }),
      });
      await expect(service.getAgentById('bad')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateAgentStatus', () => {
    it('updates agentProfile.status and returns refreshed agent', async () => {
      const save = jest.fn().mockResolvedValue(undefined);
      const agentDoc = { agentProfile: {}, save };
      let findOneCalls = 0;
      userModel.findOne = jest.fn().mockImplementation(() => {
        findOneCalls += 1;
        if (findOneCalls === 1) {
          return {
            exec: jest.fn().mockResolvedValue(agentDoc),
          };
        }
        return {
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue({
                _id: 'a1',
                role: Role.Agent,
                agentProfile: { status: AgentStatus.Approved },
              }),
            }),
          }),
        };
      });

      const result = await service.updateAgentStatus('a1', {
        status: AgentStatus.Approved,
      });
      expect(save).toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({
          agentProfile: expect.objectContaining({
            status: AgentStatus.Approved,
          }),
        }),
      );
    });
  });

  describe('getAnalytics', () => {
    it('returns overview and chart-shaped payload', async () => {
      const result = await service.getAnalytics();
      expect(result.overview).toEqual(
        expect.objectContaining({
          totalShipments: 0,
          totalAgents: 0,
          totalShippers: 0,
          totalRevenue: 0,
        }),
      );
      expect(result.quoteActivity).toEqual({
        pending: 0,
        approved: 0,
        rejected: 0,
        accepted: 0,
      });
      expect(Array.isArray(result.shipmentsOverTime)).toBe(true);
      expect(Array.isArray(result.topTradeRoutes)).toBe(true);
    });
  });
});
