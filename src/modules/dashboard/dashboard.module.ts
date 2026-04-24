import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Shipment, ShipmentSchema } from '../shipment/entities/shipment.entity';
import { ShipmentModule } from '../shipment/shipment.module';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Shipment.name, schema: ShipmentSchema }]),
    ShipmentModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
