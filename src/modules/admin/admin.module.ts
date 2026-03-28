import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../user/entities/user.entity';
import { Shipment, ShipmentSchema } from '../shipment/entities/shipment.entity';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { UserModule } from '../user/user.module';
import { ShipmentModule } from '../shipment/shipment.module';
import { QuotesModule } from '../quotes/quotes.module';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Shipment.name, schema: ShipmentSchema },
    ]),
    UserModule,
    ShipmentModule,
    QuotesModule,
    PlatformSettingsModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
