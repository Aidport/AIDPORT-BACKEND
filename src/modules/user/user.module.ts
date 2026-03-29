import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './entities/user.entity';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { AgentsController } from './agents.controller';
import { EncryptionModule } from '../../core/encryption/encryption.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    EncryptionModule,
  ],
  controllers: [UserController, AgentsController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
