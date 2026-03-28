import { Controller, Get, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/decorators/roles.decorator';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('me')
  getMyDashboard(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    if (role === Role.Agent) {
      return this.dashboardService.getAgentDashboard(userId);
    }
    return this.dashboardService.getUserDashboard(userId);
  }

  @Get('user')
  @UseGuards(RolesGuard)
  @Roles(Role.User)
  getUserDashboard(@CurrentUser('id') userId: string) {
    return this.dashboardService.getUserDashboard(userId);
  }

  @Get('agent')
  @UseGuards(RolesGuard)
  @Roles(Role.Agent)
  getAgentDashboard(@CurrentUser('id') agentId: string) {
    return this.dashboardService.getAgentDashboard(agentId);
  }
}
