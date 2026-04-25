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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { SWAGGER_BEARER } from '../../common/swagger/swagger.setup';
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
import { SendInvoiceDto } from '../shipment/dto/send-invoice.dto';
import { AssignShipmentDto } from '../shipment/dto/assign-shipment.dto';
import { MarkShipmentPaidDto } from './dto/mark-shipment-paid.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';

@ApiTags('Admin')
@ApiBearerAuth(SWAGGER_BEARER)
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

  @Patch('users/:id')
  @ApiOperation({
    summary: 'Update user (e.g. account state)',
    description: 'Set `userState` to `active` to approve a pending agent account.',
  })
  updateUserByAdmin(@Param('id') id: string, @Body() dto: UpdateAdminUserDto) {
    return this.adminService.updateUserByAdmin(id, dto);
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

  @Post('shipments/:id/send-invoice')
  @ApiOperation({
    summary: 'Email invoice to shipper',
    description:
      'Stores parcel line items, total, and Paystack link on the shipment; emails the shipper (customer) with the payment link, and emails the linked agent (assignedAgentId, else acceptedBy, else requestedAgentId) a notification with shipment id and customer details when that agent differs from the shipper.',
  })
  sendShipmentInvoice(
    @Param('id') id: string,
    @Body() dto: SendInvoiceDto,
  ) {
    return this.adminService.sendShipmentInvoice(id, dto);
  }

  @Patch('shipments/:id/mark-paid')
  @ApiOperation({
    summary: 'Record payment received',
    description:
      'Sets paymentStatus and status to paid. Optionally set `amountPaid` (defaults to invoice total or shipment amount). Sets `paidAt`.',
  })
  markShipmentPaid(
    @Param('id') id: string,
    @Body() dto: MarkShipmentPaidDto,
  ) {
    return this.adminService.markShipmentPaid(id, dto);
  }

  @Patch('shipments/:id/assign')
  @ApiOperation({
    summary: 'Assign agent after payment',
    description:
      'Requires paymentStatus paid. Sets assignedAgentId and moves status to processing.',
  })
  assignShipment(@Param('id') id: string, @Body() dto: AssignShipmentDto) {
    return this.adminService.assignShipment(id, dto);
  }

  @Patch('shipments/:id')
  updateShipment(
    @Param('id') id: string,
    @Body() dto: UpdateShipmentDto,
  ) {
    return this.adminService.updateShipmentAdmin(id, dto);
  }

  @Get('dashboard')
  @ApiOperation({
    summary: 'Full admin dashboard (single payload for Overview)',
    description:
      'KPIs (shipments, agents, shippers, delivered, pending, revenue, shipmentStats), ' +
      'shipments over time, quote activity (doughnut), user registrations (monthly + by weekday), ' +
      'top trade routes, raw `recentShipments` + table-shaped `recentShipmentsView` (incl. imageUrls). ' +
      'Same data as `GET /admin/analytics` — prefer this route for the UI.',
  })
  getDashboard() {
    return this.adminService.getAdminDashboard();
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Same as GET /admin/dashboard (legacy alias)' })
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
