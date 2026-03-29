import { Test, TestingModule } from '@nestjs/testing';
import { AgentService } from './agent.service';
import { UserService } from '../user/user.service';
import { QuotesService } from '../quotes/quotes.service';
import { ShipmentService } from '../shipment/shipment.service';
import {
  AgentPricingPlan,
  TransportMode,
} from '../user/entities/agent-profile.schema';
import { CompleteAgentProfileDto } from '../user/dto/complete-agent-profile.dto';

describe('AgentService', () => {
  let service: AgentService;
  let userService: {
    assertAgentCanOperate: jest.Mock;
    findById: jest.Mock;
    completeAgentProfile: jest.Mock;
  };
  let quotesService: { findOpenForAgents: jest.Mock; acceptQuoteByAgent: jest.Mock };
  let shipmentService: { agentSetRates: jest.Mock };

  beforeEach(async () => {
    userService = {
      assertAgentCanOperate: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn().mockResolvedValue({ id: 'a1', role: 'agent' }),
      completeAgentProfile: jest.fn().mockResolvedValue({ id: 'a1' }),
    };
    quotesService = {
      findOpenForAgents: jest.fn().mockResolvedValue({ items: [] }),
      acceptQuoteByAgent: jest.fn().mockResolvedValue({ _id: 'q1' }),
    };
    shipmentService = {
      agentSetRates: jest.fn().mockResolvedValue({ _id: 's1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentService,
        { provide: UserService, useValue: userService },
        { provide: QuotesService, useValue: quotesService },
        { provide: ShipmentService, useValue: shipmentService },
      ],
    }).compile();

    service = module.get<AgentService>(AgentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('getMe delegates to UserService.findById', async () => {
    await service.getMe('a1');
    expect(userService.findById).toHaveBeenCalledWith('a1');
  });

  it('completeProfile delegates to UserService.completeAgentProfile', async () => {
    const dto: CompleteAgentProfileDto = {
      pricingPlan: AgentPricingPlan.Basic,
      companyName: 'Co',
      dateEstablished: '2020-01-01',
      location: 'Lagos',
      aboutCompany: 'About us here ok.',
      transportModes: [TransportMode.Sea],
    };
    await service.completeProfile('a1', dto);
    expect(userService.completeAgentProfile).toHaveBeenCalledWith('a1', dto);
  });

  it('listOpenQuotes asserts agent then lists quotes', async () => {
    await service.listOpenQuotes('a1', { page: 1, limit: 10 });
    expect(userService.assertAgentCanOperate).toHaveBeenCalledWith('a1');
    expect(quotesService.findOpenForAgents).toHaveBeenCalled();
  });

  it('acceptQuote asserts agent and delegates', async () => {
    await service.acceptQuote('a1', 'q1', { amount: 100 });
    expect(userService.assertAgentCanOperate).toHaveBeenCalledWith('a1');
    expect(quotesService.acceptQuoteByAgent).toHaveBeenCalledWith('q1', 'a1', {
      amount: 100,
    });
  });

  it('addShipmentRates asserts agent and delegates', async () => {
    await service.addShipmentRates('a1', 's1', {
      amount: 200,
      currency: 'NGN',
    });
    expect(userService.assertAgentCanOperate).toHaveBeenCalledWith('a1');
    expect(shipmentService.agentSetRates).toHaveBeenCalledWith('s1', 'a1', {
      amount: 200,
      currency: 'NGN',
    });
  });
});
