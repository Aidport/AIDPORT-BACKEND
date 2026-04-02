import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { QuotesService } from './quotes.service';
import { Quote, QuoteStatus } from './entities/quote.entity';
import { Shipment } from '../shipment/entities/shipment.entity';
import { ShipmentService } from '../shipment/shipment.service';

describe('QuotesService', () => {
  let service: QuotesService;
  let quoteModel: Record<string, jest.Mock>;
  let shipmentModel: { findById: jest.Mock };
  let shipmentService: { accept: jest.Mock; agentSetRates: jest.Mock };

  beforeEach(async () => {
    shipmentService = {
      accept: jest.fn().mockResolvedValue(undefined),
      agentSetRates: jest.fn().mockResolvedValue(undefined),
    };

    const findChain = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    };

    const save = jest.fn().mockResolvedValue({
      _id: 'q1',
      status: QuoteStatus.Pending,
    });
    const QuoteConstructor = jest.fn().mockImplementation(() => ({ save }));

    quoteModel = QuoteConstructor as any;
    quoteModel.find = jest.fn().mockReturnValue(findChain);
    quoteModel.findById = jest.fn();
    quoteModel.findByIdAndUpdate = jest.fn().mockReturnValue({
      exec: jest.fn(),
    });
    quoteModel.findOneAndUpdate = jest.fn();
    quoteModel.countDocuments = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(0),
    });
    quoteModel.aggregate = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue([
        { _id: QuoteStatus.Pending, count: 3 },
        { _id: QuoteStatus.Approved, count: 5 },
        { _id: QuoteStatus.Rejected, count: 1 },
        { _id: QuoteStatus.Accepted, count: 2 },
      ]),
    });

    shipmentModel = {
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuotesService,
        { provide: getModelToken(Quote.name), useValue: quoteModel },
        { provide: getModelToken(Shipment.name), useValue: shipmentModel },
        { provide: ShipmentService, useValue: shipmentService },
      ],
    }).compile();

    service = module.get<QuotesService>(QuotesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a pending quote for the user', async () => {
      const doc = await service.create('507f1f77bcf86cd799439011', {
        originCity: 'Lagos',
        destinationCity: 'London',
        weightKg: 10,
      });
      expect(quoteModel).toHaveBeenCalled();
      expect(doc).toEqual(expect.objectContaining({ _id: 'q1' }));
    });

    it('should reject quote for shipment owned by another user', async () => {
      shipmentModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          createdBy: new Types.ObjectId(),
        }),
      });
      await expect(
        service.create('507f1f77bcf86cd799439011', {
          shipmentId: '507f1f77bcf86cd799439099',
        }),
      ).rejects.toThrow('own shipments');
    });
  });

  describe('findAllForAdmin', () => {
    it('should return paginated result', async () => {
      const result = await service.findAllForAdmin({ page: 1, limit: 10 });
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('updateStatus', () => {
    it('should update quote status', async () => {
      quoteModel.findByIdAndUpdate.mockReturnValue({
        exec: jest
          .fn()
          .mockResolvedValue({ _id: 'q1', status: QuoteStatus.Approved }),
      });
      const result = await service.updateStatus('q1', QuoteStatus.Approved);
      expect(result.status).toBe(QuoteStatus.Approved);
    });

    it('should reject setting accepted via admin update', async () => {
      await expect(
        service.updateStatus('q1', QuoteStatus.Accepted),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when quote missing', async () => {
      quoteModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(
        service.updateStatus('missing', QuoteStatus.Rejected),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('acceptQuoteByAgent', () => {
    const shipmentOid = new Types.ObjectId();

    it('should accept quote, assign shipment, and set rate', async () => {
      const agentId = '507f1f77bcf86cd7994390aa';
      let findByIdCalls = 0;
      quoteModel.findById = jest.fn().mockImplementation(() => {
        findByIdCalls += 1;
        if (findByIdCalls === 1) {
          return {
            exec: jest.fn().mockResolvedValue({
              status: QuoteStatus.Approved,
              shipmentId: shipmentOid,
            }),
          };
        }
        return {
          populate: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue({ _id: 'q1' }),
        };
      });

      quoteModel.findOneAndUpdate.mockResolvedValue({
        status: QuoteStatus.Accepted,
      });

      await service.acceptQuoteByAgent('q1', agentId, { amount: 5000 });

      expect(shipmentService.accept).toHaveBeenCalledWith(
        String(shipmentOid),
        agentId,
      );
      expect(shipmentService.agentSetRates).toHaveBeenCalledWith(
        String(shipmentOid),
        agentId,
        {
          rates: [
            {
              type: 'local',
              originZone: '',
              destinationZone: '',
              price: 5000,
            },
          ],
        },
      );
    });

    it('should throw when quote not approved', async () => {
      quoteModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          status: QuoteStatus.Pending,
          shipmentId: shipmentOid,
        }),
      });
      await expect(
        service.acceptQuoteByAgent('q1', '507f1f77bcf86cd7994390aa'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('countByStatus', () => {
    it('should aggregate counts including accepted', async () => {
      const counts = await service.countByStatus();
      expect(counts.pending).toBe(3);
      expect(counts.approved).toBe(5);
      expect(counts.rejected).toBe(1);
      expect(counts.accepted).toBe(2);
    });
  });
});
