import { Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { QuotesModule } from '../quotes/quotes.module';
import { ShipmentModule } from '../shipment/shipment.module';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';

@Module({
  imports: [UserModule, QuotesModule, ShipmentModule],
  controllers: [AgentController],
  providers: [AgentService],
})
export class AgentModule {}
