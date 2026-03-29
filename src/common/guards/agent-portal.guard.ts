import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { UserService } from '../../modules/user/user.service';

/**
 * Allows users with an agent application (agentProfile): role user (applicant) or agent (operator).
 * Shipper accounts (no agentProfile) are rejected.
 */
@Injectable()
export class AgentPortalGuard implements CanActivate {
  constructor(private readonly userService: UserService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ user?: { id: string } }>();
    const userId = req.user?.id;
    if (!userId) {
      throw new ForbiddenException('User not authenticated');
    }
    const ok = await this.userService.canAccessAgentPortal(userId);
    if (!ok) {
      throw new ForbiddenException('Agent portal access only');
    }
    return true;
  }
}
