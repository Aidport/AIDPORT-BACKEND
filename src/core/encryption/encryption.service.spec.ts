import { Test, TestingModule } from '@nestjs/testing';
import { EncryptionService } from './encryption.service';

describe('EncryptionService', () => {
  let service: EncryptionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EncryptionService],
    }).compile();

    service = module.get<EncryptionService>(EncryptionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('hash', () => {
    it('should hash a password', async () => {
      const password = 'mySecurePassword123';
      const hash = await service.hash(password);
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50);
    });

    it('should produce different hashes for same password', async () => {
      const password = 'samePassword';
      const [hash1, hash2] = await Promise.all([
        service.hash(password),
        service.hash(password),
      ]);
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verify', () => {
    it('should verify correct password', async () => {
      const password = 'testPassword';
      const hash = await service.hash(password);
      const valid = await service.verify(hash, password);
      expect(valid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'testPassword';
      const hash = await service.hash(password);
      const valid = await service.verify(hash, 'wrongPassword');
      expect(valid).toBe(false);
    });
  });
});
