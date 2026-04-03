import { Injectable } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { QuotesService } from '../quotes/quotes.service';
import { ShipmentService } from '../shipment/shipment.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { AgentAddRatesDto } from './dto/agent-add-rates.dto';
import { CompleteAgentProfileDto } from '../user/dto/complete-agent-profile.dto';
import { UpdateAgentDocumentsDto } from '../user/dto/update-agent-documents.dto';
import { AddInternationalAgentRateDto } from '../user/dto/add-international-agent-rate.dto';
import { AddLocalAgentRateDto } from '../user/dto/add-local-agent-rate.dto';
import { UpdateInternationalAgentRateDto } from '../user/dto/update-international-agent-rate.dto';
import { UpdateLocalAgentRateDto } from '../user/dto/update-local-agent-rate.dto';

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

  updateDocuments(agentId: string, dto: UpdateAgentDocumentsDto) {
    return this.userService.updateAgentDocumentUrls(agentId, dto);
  }

  addLocalRate(agentId: string, dto: AddLocalAgentRateDto) {
    return this.userService.addAgentLocalRate(agentId, dto);
  }

  addInternationalRate(agentId: string, dto: AddInternationalAgentRateDto) {
    return this.userService.addAgentInternationalRate(agentId, dto);
  }

  getLocalRates(agentId: string) {
    return this.userService.getAgentLocalRates(agentId);
  }

  getInternationalRates(agentId: string) {
    return this.userService.getAgentInternationalRates(agentId);
  }

  updateLocalRate(agentId: string, rateId: string, dto: UpdateLocalAgentRateDto) {
    return this.userService.updateAgentLocalRate(agentId, rateId, dto);
  }

  updateInternationalRate(agentId: string, rateId: string, dto: UpdateInternationalAgentRateDto) {
    return this.userService.updateAgentInternationalRate(agentId, rateId, dto);
  }

  deleteLocalRate(agentId: string, rateId: string) {
    return this.userService.deleteAgentLocalRate(agentId, rateId);
  }

  deleteInternationalRate(agentId: string, rateId: string) {
    return this.userService.deleteAgentInternationalRate(agentId, rateId);
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
