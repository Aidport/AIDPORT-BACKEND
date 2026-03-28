import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: unknown) => {
              const map: Record<string, unknown> = {
                SMTP_HOST: 'smtp.gmail.com',
                SMTP_PORT: 587,
                SMTP_SECURE: false,
                SMTP_USER: 'test@gmail.com',
                SMTP_PASS: 'app-password',
                SMTP_FROM: 'noreply@aidport.com',
              };
              return map[key] ?? defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('isConfigured', () => {
    it('should return true when SMTP_USER and SMTP_PASS are set', () => {
      expect(service.isConfigured()).toBe(true);
    });
  });
});
