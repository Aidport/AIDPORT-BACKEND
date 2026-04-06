import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Shipment, ShipmentSchema } from './entities/shipment.entity';
import { User, UserSchema } from '../user/entities/user.entity';
import { ShipmentService } from './shipment.service';
import { ShipmentController } from './shipment.controller';
import { EmailModule } from '../../integrations/email/email.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Shipment.name, schema: ShipmentSchema },
      { name: User.name, schema: UserSchema },
    ]),
    EmailModule,
  ],
  controllers: [ShipmentController],
  providers: [ShipmentService],
  exports: [ShipmentService],
})
export class ShipmentModule {}
