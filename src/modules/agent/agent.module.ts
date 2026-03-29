import { Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { QuotesModule } from '../quotes/quotes.module';
import { ShipmentModule } from '../shipment/shipment.module';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { AgentPortalGuard } from '../../common/guards/agent-portal.guard';

@Module({
  imports: [UserModule, QuotesModule, ShipmentModule],
  controllers: [AgentController],
  providers: [AgentService, AgentPortalGuard],
})
export class AgentModule {}
