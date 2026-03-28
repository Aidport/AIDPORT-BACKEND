import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

@Injectable()
export class EncryptionService {
  private readonly hashOptions: argon2.Options = {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 2,
  };

  async hash(password: string): Promise<string> {
    return argon2.hash(password, this.hashOptions);
  }

  async verify(hash: string, password: string): Promise<boolean> {
    return argon2.verify(hash, password);
  }
}
