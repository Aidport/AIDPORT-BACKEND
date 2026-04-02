import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { ShipmentService } from './shipment.service';
import { Shipment, ShipmentRateKind, ShipmentStatus } from './entities/shipment.entity';
import { Types } from 'mongoose';

describe('ShipmentService', () => {
  let service: ShipmentService;
  let mockShipmentModel: any;

  const mockShipment = {
    _id: new Types.ObjectId(),
    cargoName: 'Medical Supplies',
    category: 'medical',
    originCity: 'Lagos',
    destinationCity: 'Abuja',
    status: ShipmentStatus.Pending,
    events: [],
    createdBy: new Types.ObjectId(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    mockShipmentModel = {
      find: jest.fn().mockReturnThis(),
      findById: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
      countDocuments: jest.fn().mockResolvedValue(0),
      prototype: {},
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShipmentService,
        {
          provide: getModelToken(Shipment.name),
          useValue: mockShipmentModel,
        },
      ],
    }).compile();

    service = module.get<ShipmentService>(ShipmentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOne', () => {
    it('should throw NotFoundException when shipment not found', async () => {
      mockShipmentModel.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(null),
          }),
        }),
      });
      (service as any).shipmentModel = mockShipmentModel;
      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('accept', () => {
    it('should throw ForbiddenException when shipment not pending', async () => {
      const shipment = {
        ...mockShipment,
        status: ShipmentStatus.Accepted,
        save: jest.fn(),
      };
      mockShipmentModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(shipment),
      });
      (service as any).shipmentModel = mockShipmentModel;
      await expect(
        service.accept(shipment._id.toString(), 'agentId'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findForAdmin', () => {
    beforeEach(() => {
      mockShipmentModel.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            sort: jest.fn().mockReturnValue({
              skip: jest.fn().mockReturnValue({
                limit: jest.fn().mockReturnValue({
                  lean: jest.fn().mockResolvedValue([]),
                }),
              }),
            }),
          }),
        }),
      });
      mockShipmentModel.countDocuments = jest.fn().mockResolvedValue(0);
      (service as any).shipmentModel = mockShipmentModel;
    });

    it('should apply active filter (accepted, in_transit, delayed)', async () => {
      await service.findForAdmin(
        { page: 1, limit: 10 },
        { dashboardFilter: 'active' },
      );
      expect(mockShipmentModel.find).toHaveBeenCalledWith({
        status: {
          $in: [
            ShipmentStatus.Accepted,
            ShipmentStatus.InTransit,
            ShipmentStatus.Delayed,
          ],
        },
      });
    });

    it('should apply pending status filter', async () => {
      await service.findForAdmin(
        { page: 1, limit: 10 },
        { dashboardFilter: 'pending' },
      );
      expect(mockShipmentModel.find).toHaveBeenCalledWith({
        status: ShipmentStatus.Pending,
      });
    });

    it('should prefer explicit status over dashboard filter', async () => {
      await service.findForAdmin(
        { page: 1, limit: 10 },
        { dashboardFilter: 'pending', status: ShipmentStatus.Delivered },
      );
      expect(mockShipmentModel.find).toHaveBeenCalledWith({
        status: ShipmentStatus.Delivered,
      });
    });
  });

  describe('agentSetRates', () => {
    it('should throw when agent is not assigned', async () => {
      mockShipmentModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          acceptedBy: new Types.ObjectId(),
          save: jest.fn(),
        }),
      });
      (service as any).shipmentModel = mockShipmentModel;
      await expect(
        service.agentSetRates('s1', 'otherAgent', {
          rates: [
            {
              type: ShipmentRateKind.Local,
              originZone: 'a',
              destinationZone: 'b',
              price: 100,
            },
          ],
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
