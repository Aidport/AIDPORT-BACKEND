import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { AgentModule } from './modules/agent/agent.module';
import { ShipmentModule } from './modules/shipment/shipment.module';
import { AdminModule } from './modules/admin/admin.module';
import { QuotesModule } from './modules/quotes/quotes.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { UploadModule } from './modules/upload/upload.module';
import { EncryptionModule } from './core/encryption/encryption.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://localhost:27017/aidport', {
      maxPoolSize: 10,
      minPoolSize: 5,
    }),
    EncryptionModule,
    AuthModule,
    UserModule,
    AgentModule,
    ShipmentModule,
    UploadModule,
    AdminModule,
    QuotesModule,
    DashboardModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
