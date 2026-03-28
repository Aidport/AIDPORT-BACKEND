import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AgentService } from './agent.service';
import { SWAGGER_BEARER } from '../../common/swagger/swagger.setup';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, Role } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { AcceptAgentQuoteDto } from './dto/accept-agent-quote.dto';
import { AgentAddRatesDto } from './dto/agent-add-rates.dto';

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
  addRates(
    @Param('shipmentId') shipmentId: string,
    @CurrentUser('id') agentId: string,
    @Body() dto: AgentAddRatesDto,
  ) {
    return this.agentService.addShipmentRates(agentId, shipmentId, dto);
  }
}
