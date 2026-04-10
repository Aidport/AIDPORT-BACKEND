import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AgentService } from './agent.service';
import { SWAGGER_BEARER } from '../../common/swagger/swagger.setup';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, Role } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { AcceptAgentQuoteDto } from './dto/accept-agent-quote.dto';
import { AgentAddRatesDto } from './dto/agent-add-rates.dto';
import { CompleteAgentProfileDto } from '../user/dto/complete-agent-profile.dto';
import { UpdateAgentDocumentsDto } from '../user/dto/update-agent-documents.dto';
import { AddInternationalAgentRateDto } from '../user/dto/add-international-agent-rate.dto';
import { AddLocalAgentRateDto } from '../user/dto/add-local-agent-rate.dto';
import { UpdateInternationalAgentRateDto } from '../user/dto/update-international-agent-rate.dto';
import { UpdateLocalAgentRateDto } from '../user/dto/update-local-agent-rate.dto';
import { AddContraAgentRateDto } from '../user/dto/add-contra-agent-rate.dto';
import { UpdateContraAgentRateDto } from '../user/dto/update-contra-agent-rate.dto';
import { SetAgentContraPriceDto } from '../user/dto/set-agent-contra-price.dto';

@ApiTags('Agent')
@ApiBearerAuth(SWAGGER_BEARER)
@Controller('agent')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Agent)
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Get('me')
  me(@CurrentUser('id') agentId: string) {
    return this.agentService.getMe(agentId);
  }

  @Get('shipments')
  @ApiOperation({
    summary: 'My assigned shipments',
    description:
      'Lists shipments where this agent is set as `assignedAgentId` (admin assigns after payment).',
  })
  listMyShipments(
    @CurrentUser('id') agentId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.agentService.listAssignedShipments(agentId, pagination);
  }

  /** Step 2: submit company profile after POST /auth/signup/agent (step 1). */
  @Patch('profile')
  completeProfile(
    @CurrentUser('id') agentId: string,
    @Body() dto: CompleteAgentProfileDto,
  ) {
    return this.agentService.completeProfile(agentId, dto);
  }

  @Patch('documents')
  @ApiOperation({
    summary: 'Set company document URLs',
    description:
      'Upload files with POST /upload, then send the returned `url` values here. Replaces the full list; use [] to clear. Required for documents to appear on GET /agent/me.',
  })
  updateDocuments(
    @CurrentUser('id') agentId: string,
    @Body() dto: UpdateAgentDocumentsDto,
  ) {
    return this.agentService.updateDocuments(agentId, dto);
  }

  @Post('rates/local')
  @ApiOperation({ summary: 'Add a local rate (appends; does not replace existing).' })
  addLocalRate(
    @CurrentUser('id') agentId: string,
    @Body() dto: AddLocalAgentRateDto,
  ) {
    return this.agentService.addLocalRate(agentId, dto);
  }

  @Post('rates/international')
  @ApiOperation({ summary: 'Add an international rate (appends).' })
  addInternationalRate(
    @CurrentUser('id') agentId: string,
    @Body() dto: AddInternationalAgentRateDto,
  ) {
    return this.agentService.addInternationalRate(agentId, dto);
  }

  @Get('rates/local')
  @ApiOperation({ summary: 'List all local rates on the agent profile' })
  getLocalRates(@CurrentUser('id') agentId: string) {
    return this.agentService.getLocalRates(agentId);
  }

  @Get('rates/international')
  @ApiOperation({ summary: 'List all international rates on the agent profile' })
  getInternationalRates(@CurrentUser('id') agentId: string) {
    return this.agentService.getInternationalRates(agentId);
  }

  @Patch('rates/local/:rateId')
  @ApiOperation({ summary: 'Update one local rate by id' })
  updateLocalRate(
    @CurrentUser('id') agentId: string,
    @Param('rateId') rateId: string,
    @Body() dto: UpdateLocalAgentRateDto,
  ) {
    return this.agentService.updateLocalRate(agentId, rateId, dto);
  }

  @Patch('rates/international/:rateId')
  @ApiOperation({ summary: 'Update one international rate by id' })
  updateInternationalRate(
    @CurrentUser('id') agentId: string,
    @Param('rateId') rateId: string,
    @Body() dto: UpdateInternationalAgentRateDto,
  ) {
    return this.agentService.updateInternationalRate(agentId, rateId, dto);
  }

  @Delete('rates/local/:rateId')
  @ApiOperation({ summary: 'Delete one local rate by id' })
  deleteLocalRate(
    @CurrentUser('id') agentId: string,
    @Param('rateId') rateId: string,
  ) {
    return this.agentService.deleteLocalRate(agentId, rateId);
  }

  @Delete('rates/international/:rateId')
  @ApiOperation({ summary: 'Delete one international rate by id' })
  deleteInternationalRate(
    @CurrentUser('id') agentId: string,
    @Param('rateId') rateId: string,
  ) {
    return this.agentService.deleteInternationalRate(agentId, rateId);
  }

  @Post('rates/contra')
  @ApiOperation({ summary: 'Add a contra rate line (price-only; appends).' })
  addContraRate(
    @CurrentUser('id') agentId: string,
    @Body() dto: AddContraAgentRateDto,
  ) {
    return this.agentService.addContraRate(agentId, dto);
  }

  @Get('rates/contra')
  @ApiOperation({ summary: 'List contra rate lines on the agent profile' })
  getContraRates(@CurrentUser('id') agentId: string) {
    return this.agentService.getContraRates(agentId);
  }

  @Patch('rates/contra/:rateId')
  @ApiOperation({ summary: 'Update one contra rate by id' })
  updateContraRate(
    @CurrentUser('id') agentId: string,
    @Param('rateId') rateId: string,
    @Body() dto: UpdateContraAgentRateDto,
  ) {
    return this.agentService.updateContraRate(agentId, rateId, dto);
  }

  @Delete('rates/contra/:rateId')
  @ApiOperation({ summary: 'Delete one contra rate by id' })
  deleteContraRate(
    @CurrentUser('id') agentId: string,
    @Param('rateId') rateId: string,
  ) {
    return this.agentService.deleteContraRate(agentId, rateId);
  }

  @Patch('profile/contra-price')
  @ApiOperation({
    summary: 'Set standalone contra price on profile',
    description:
      'Separate from local/international lines. Use DELETE /agent/profile/contra-price to clear.',
  })
  setContraPrice(
    @CurrentUser('id') agentId: string,
    @Body() dto: SetAgentContraPriceDto,
  ) {
    return this.agentService.setContraPrice(agentId, dto);
  }

  @Delete('profile/contra-price')
  @ApiOperation({ summary: 'Clear standalone contra price on profile' })
  clearContraPrice(@CurrentUser('id') agentId: string) {
    return this.agentService.clearContraPrice(agentId);
  }

  /** Admin-approved quotes awaiting an agent (linked to shipments) */
  @Get('quotes')
  listOpenQuotes(
    @CurrentUser('id') agentId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.agentService.listOpenQuotes(agentId, pagination);
  }

  @Post('quotes/:quoteId/accept')
  acceptQuote(
    @Param('quoteId') quoteId: string,
    @CurrentUser('id') agentId: string,
    @Body() dto: AcceptAgentQuoteDto,
  ) {
    return this.agentService.acceptQuote(agentId, quoteId, dto);
  }

  @Patch('shipments/:shipmentId/rates')
  @ApiOperation({
    summary: 'Set shipment commercial rates',
    description:
      'Provide `rates`: local (zones), international (countries optional), and/or contra (price-only). `amount` sums `price` + `basicPrice` per line.',
  })
  addRates(
    @Param('shipmentId') shipmentId: string,
    @CurrentUser('id') agentId: string,
    @Body() dto: AgentAddRatesDto,
  ) {
    return this.agentService.addShipmentRates(agentId, shipmentId, dto);
  }
}
