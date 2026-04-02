import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ShipmentService } from './shipment.service';
import { SWAGGER_BEARER } from '../../common/swagger/swagger.setup';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { SendShipmentRequestDto } from './dto/send-shipment-request.dto';
import { UpdateShipmentDto } from './dto/update-shipment.dto';
import { UpdateShipmentStatusDto } from './dto/update-shipment-status.dto';
import { GetRatesDto } from './dto/get-rates.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ShipmentStatus } from './entities/shipment.entity';
import { Role } from '../../common/decorators/roles.decorator';

@ApiTags('Shipments')
@ApiBearerAuth(SWAGGER_BEARER)
@Controller('shipments')
@UseGuards(JwtAuthGuard)
export class ShipmentController {
  constructor(private readonly shipmentService: ShipmentService) {}

  @Post()
  create(
    @Body() createShipmentDto: CreateShipmentDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.shipmentService.create(createShipmentDto, userId);
  }

  /** Full shipment payload + target agent id; status = `requested`. */
  @Post('request')
  sendShipmentRequest(
    @Body() dto: SendShipmentRequestDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.shipmentService.sendShipmentRequest(dto, userId);
  }

  @Get()
  findAll(
    @Query() pagination: PaginationDto,
    @Query('status') status?: ShipmentStatus,
  ) {
    return this.shipmentService.findAll(pagination, status ? { status } : undefined);
  }

  @Get('incoming')
  @UseGuards(RolesGuard)
  @Roles(Role.Agent)
  findIncoming(
    @CurrentUser('id') agentId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.shipmentService.findIncoming(agentId, pagination);
  }

  /** Get estimated shipping rates */
  @Post('rates')
  getRates(@Body() dto: GetRatesDto) {
    return this.shipmentService.getRates(dto);
  }

  @Post(':id/accept-request')
  @UseGuards(RolesGuard)
  @Roles(Role.Agent)
  acceptShipmentRequest(
    @Param('id') id: string,
    @CurrentUser('id') agentId: string,
  ) {
    return this.shipmentService.acceptShipmentRequest(id, agentId);
  }

  @Post(':id/decline-request')
  @UseGuards(RolesGuard)
  @Roles(Role.Agent)
  declineShipmentRequest(
    @Param('id') id: string,
    @CurrentUser('id') agentId: string,
  ) {
    return this.shipmentService.declineShipmentRequest(id, agentId);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(Role.Agent)
  updateShipmentStatus(
    @Param('id') id: string,
    @Body() dto: UpdateShipmentStatusDto,
    @CurrentUser('id') agentId: string,
  ) {
    return this.shipmentService.updateShipmentStatusByAgent(id, agentId, dto);
  }

  @Get(':id/track')
  track(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.shipmentService.track(id, userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.shipmentService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateShipmentDto: UpdateShipmentDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.shipmentService.update(id, updateShipmentDto, userId);
  }

  @Post(':id/accept')
  @UseGuards(RolesGuard)
  @Roles(Role.Agent)
  accept(@Param('id') id: string, @CurrentUser('id') agentId: string) {
    return this.shipmentService.accept(id, agentId);
  }

  @Post(':id/decline')
  @UseGuards(RolesGuard)
  @Roles(Role.Agent)
  decline(@Param('id') id: string, @CurrentUser('id') agentId: string) {
    return this.shipmentService.decline(id, agentId);
  }

  @Post(':id/delivered')
  @UseGuards(RolesGuard)
  @Roles(Role.Agent)
  markDelivered(@Param('id') id: string, @CurrentUser('id') agentId: string) {
    return this.shipmentService.markDelivered(id, agentId);
  }
}
