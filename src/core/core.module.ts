import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { EncryptionService } from './encryption.service';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local', '.env.test'],
    }),
    MongooseModule.forRoot(process.env.MONGODB_URI ?? 'mongodb://localhost:27017/aidport', {
      maxPoolSize: 10,
      minPoolSize: 5,
      retryWrites: true,
      retryReads: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    }),
  ],
  providers: [EncryptionService],
  exports: [EncryptionService],
})
export class CoreModule {}
