import { Injectable } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { QuotesService } from '../quotes/quotes.service';
import { ShipmentService } from '../shipment/shipment.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { AgentAddRatesDto } from './dto/agent-add-rates.dto';
import { CompleteAgentProfileDto } from '../user/dto/complete-agent-profile.dto';

@Injectable()
export class AgentService {
  constructor(
    private readonly userService: UserService,
    private readonly quotesService: QuotesService,
    private readonly shipmentService: ShipmentService,
  ) {}

  getMe(agentId: string) {
    return this.userService.findById(agentId);
  }

  completeProfile(agentId: string, dto: CompleteAgentProfileDto) {
    return this.userService.completeAgentProfile(agentId, dto);
  }

  async listOpenQuotes(agentId: string, pagination: PaginationDto) {
    await this.userService.assertAgentCanOperate(agentId);
    return this.quotesService.findOpenForAgents(pagination);
  }

  async acceptQuote(
    agentId: string,
    quoteId: string,
    dto?: { amount?: number },
  ) {
    await this.userService.assertAgentCanOperate(agentId);
    return this.quotesService.acceptQuoteByAgent(quoteId, agentId, dto);
  }

  async addShipmentRates(
    agentId: string,
    shipmentId: string,
    dto: AgentAddRatesDto,
  ) {
    await this.userService.assertAgentCanOperate(agentId);
    return this.shipmentService.agentSetRates(shipmentId, agentId, dto);
  }
}
