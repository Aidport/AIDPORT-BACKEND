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
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/decorators/roles.decorator';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { UpdateProfileDto } from '../user/dto/update-profile.dto';
import { UpdateShipmentDto } from '../shipment/dto/update-shipment.dto';
import { QuoteStatus } from '../quotes/entities/quote.entity';
import {
  AdminAgentsQueryDto,
  AdminListUsersQueryDto,
  AdminShipmentsQueryDto,
  AdminShippersQueryDto,
  UpdatePlatformSettingsDto,
} from './dto/admin-query.dto';
import {
  AdminUpdateAgentPatchDto,
  UpdateAgentStatusDto,
  UpdateQuoteStatusDto,
} from './dto/update-agent-status.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Admin)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  listUsers(@Query() query: AdminListUsersQueryDto) {
    return this.adminService.listUsers(query);
  }

  @Get('users/:id')
  getUserById(@Param('id') id: string) {
    return this.adminService.getUserById(id);
  }

  @Post('users')
  createUser(
    @Body() dto: CreateUserDto,
    @Body('role') role?: Role,
  ) {
    return this.adminService.createUser(dto, role ?? Role.User);
  }

  @Get('shippers')
  getShippers(@Query() query: AdminShippersQueryDto) {
    return this.adminService.getShippers(query);
  }

  @Get('shippers/:id')
  getShipperById(@Param('id') id: string) {
    return this.adminService.getShipperById(id);
  }

  @Patch('shippers/:id')
  updateShipper(@Param('id') id: string, @Body() dto: UpdateProfileDto) {
    return this.adminService.updateShipper(id, dto);
  }

  @Get('agents')
  getAgents(@Query() query: AdminAgentsQueryDto) {
    return this.adminService.getAgentsList(query);
  }

  @Get('agents/:id')
  getAgentById(@Param('id') id: string) {
    return this.adminService.getAgentById(id);
  }

  @Patch('agents/:id/status')
  updateAgentStatus(
    @Param('id') id: string,
    @Body() dto: UpdateAgentStatusDto,
  ) {
    return this.adminService.updateAgentStatus(id, dto);
  }

  @Patch('agents/:id')
  patchAgent(@Param('id') id: string, @Body() dto: AdminUpdateAgentPatchDto) {
    return this.adminService.patchAgent(id, dto);
  }

  @Get('shipments')
  getShipments(@Query() query: AdminShipmentsQueryDto) {
    return this.adminService.getShipmentsForAdmin(query);
  }

  @Get('order-history')
  getOrderHistory(@Query() query: AdminShipmentsQueryDto) {
    return this.adminService.getOrderHistory(query);
  }

  @Patch('shipments/:id')
  updateShipment(
    @Param('id') id: string,
    @Body() dto: UpdateShipmentDto,
  ) {
    return this.adminService.updateShipmentAdmin(id, dto);
  }

  @Get('analytics')
  getAnalytics() {
    return this.adminService.getAnalytics();
  }

  @Get('settings')
  getSettings() {
    return this.adminService.getPlatformSettings();
  }

  @Patch('settings')
  updateSettings(@Body() dto: UpdatePlatformSettingsDto) {
    return this.adminService.updatePlatformSettings(dto);
  }

  @Get('quotes')
  getQuotes(
    @Query('status') status?: QuoteStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getQuotesForAdmin(
      status,
      page ? parseInt(page, 10) : undefined,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Patch('quotes/:id/status')
  updateQuoteStatus(
    @Param('id') id: string,
    @Body() dto: UpdateQuoteStatusDto,
  ) {
    return this.adminService.updateQuoteStatus(id, dto.status);
  }

  @Get('notifications')
  getNotifications() {
    return this.adminService.getNotifications();
  }
}
