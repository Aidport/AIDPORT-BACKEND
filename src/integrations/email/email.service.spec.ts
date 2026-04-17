import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

function createModuleWithEnv(map: Record<string, unknown>) {
  return Test.createTestingModule({
    providers: [
      EmailService,
      {
        provide: ConfigService,
        useValue: {
          get: jest.fn((key: string, defaultValue?: unknown) => {
            if (key in map) {
              return map[key];
            }
            return defaultValue;
          }),
        },
      },
    ],
  }).compile();
}

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(async () => {
    const module = await createModuleWithEnv({
      SMTP_HOST: 'smtp.gmail.com',
      SMTP_PORT: 587,
      SMTP_SECURE: false,
      SMTP_USER: 'test@gmail.com',
      SMTP_PASS: 'app-password',
      SMTP_FROM: 'noreply@aidport.com',
    });
    service = module.get<EmailService>(EmailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('isConfigured', () => {
    it('should return true when SMTP_USER and SMTP_PASS are set', () => {
      expect(service.isConfigured()).toBe(true);
    });

    it('should return true when all Gmail OAuth vars are set', async () => {
      const module = await createModuleWithEnv({
        GMAIL_CLIENT_ID: 'id.apps.googleusercontent.com',
        GMAIL_CLIENT_SECRET: 'secret',
        GMAIL_REDIRECT_URI: 'https://developers.google.com/oauthplayground',
        GMAIL_REFRESH_TOKEN: '1//token',
        GMAIL_USER: 'user@gmail.com',
      });
      const s = module.get<EmailService>(EmailService);
      expect(s.isConfigured()).toBe(true);
    });

    it('should return true when Gmail OAuth uses CLIENT_ID / REFRESH_TOKEN aliases', async () => {
      const module = await createModuleWithEnv({
        CLIENT_ID: 'id.apps.googleusercontent.com',
        CLIENT_SECRET: 'secret',
        REDIRECT_URI: 'https://developers.google.com/oauthplayground',
        REFRESH_TOKEN: '1//token',
        GMAIL_NAME: 'user@gmail.com',
      });
      const s = module.get<EmailService>(EmailService);
      expect(s.isConfigured()).toBe(true);
    });
  });
});
