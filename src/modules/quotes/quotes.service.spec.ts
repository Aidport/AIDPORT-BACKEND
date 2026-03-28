import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { QuotesService } from './quotes.service';
import { Quote, QuoteStatus } from './entities/quote.entity';

function buildQuoteModelMock() {
  const save = jest.fn().mockResolvedValue({
    _id: 'q1',
    status: QuoteStatus.Pending,
  });
  const QuoteConstructor = jest.fn().mockImplementation(() => ({ save }));

  const findChain = {
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([]),
  };
  (QuoteConstructor as any).find = jest.fn().mockReturnValue(findChain);
  (QuoteConstructor as any).findByIdAndUpdate = jest.fn().mockReturnValue({
    exec: jest.fn(),
  });
  (QuoteConstructor as any).countDocuments = jest.fn().mockReturnValue({
    exec: jest.fn().mockResolvedValue(0),
  });
  (QuoteConstructor as any).aggregate = jest.fn().mockReturnValue({
    exec: jest.fn().mockResolvedValue([
      { _id: QuoteStatus.Pending, count: 3 },
      { _id: QuoteStatus.Approved, count: 5 },
      { _id: QuoteStatus.Rejected, count: 1 },
    ]),
  });

  return QuoteConstructor as any;
}

describe('QuotesService', () => {
  let service: QuotesService;
  let quoteModel: ReturnType<typeof buildQuoteModelMock>;

  beforeEach(async () => {
    quoteModel = buildQuoteModelMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuotesService,
        {
          provide: getModelToken(Quote.name),
          useValue: quoteModel,
        },
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
  });

  describe('findAllForAdmin', () => {
    it('should return paginated result', async () => {
      const result = await service.findAllForAdmin({ page: 1, limit: 10 });
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
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

    it('should throw when quote missing', async () => {
      quoteModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(
        service.updateStatus('missing', QuoteStatus.Rejected),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('countByStatus', () => {
    it('should aggregate counts into pending/approved/rejected', async () => {
      const counts = await service.countByStatus();
      expect(counts.pending).toBe(3);
      expect(counts.approved).toBe(5);
      expect(counts.rejected).toBe(1);
    });
  });
});
