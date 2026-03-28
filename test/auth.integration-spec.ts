import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { MongooseModule } from '@nestjs/mongoose';
import { getModelToken } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { AuthModule } from '../src/modules/auth/auth.module';
import { UserModule } from '../src/modules/user/user.module';
import { EncryptionModule } from '../src/core/encryption/encryption.module';
import { EmailModule } from '../src/integrations/email/email.module';
import { User, UserSchema } from '../src/modules/user/entities/user.entity';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { ValidationPipe } from '../src/common/pipes/validation.pipe';
import { EmailService } from '../src/integrations/email/email.service';
import type { Model } from 'mongoose';

describe('Auth (integration)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;
  let mongoUri: string;
  let userModel: Model<typeof User>;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'integration-test-secret';
    process.env.SMTP_USER = 'test@test.com';
    process.env.SMTP_PASS = 'test';
    mongod = await MongoMemoryServer.create();
    mongoUri = mongod.getUri();
    process.env.MONGODB_URI = mongoUri;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        MongooseModule.forRoot(mongoUri),
        MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.registerAsync({
          imports: [ConfigModule],
          useFactory: (config: ConfigService) => ({
            secret: config.get('JWT_SECRET') || 'integration-test-secret',
            signOptions: { expiresIn: '1h' as const },
          }),
          inject: [ConfigService],
        }),
        EncryptionModule,
        EmailModule,
        UserModule,
        AuthModule,
      ],
    })
      .overrideProvider(EmailService)
      .useValue({
        isConfigured: () => true,
        sendMail: jest.fn().mockResolvedValue(undefined),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
    userModel = moduleFixture.get(getModelToken(User.name));
  }, 60000);

  afterAll(async () => {
    await app?.close();
    await mongod?.stop();
  });

  it('should sign up a user', () => {
    return request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
      })
      .expect(201)
      .expect((res) => {
        expect(res.body).toHaveProperty('user');
        expect(res.body).toHaveProperty('accessToken');
        expect(res.body.user.email).toBe('john@example.com');
        expect(res.body.user).not.toHaveProperty('passwordHash');
      });
  });

  it('should reject duplicate email on signup', async () => {
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        name: 'Jane',
        email: 'duplicate@example.com',
        password: 'password123',
      })
      .expect(201);

    return request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        name: 'Jane Again',
        email: 'duplicate@example.com',
        password: 'password456',
      })
      .expect(409);
  });

  it('should login with valid credentials', async () => {
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        name: 'Login Test',
        email: 'logintest@example.com',
        password: 'mypassword',
      })
      .expect(201);

    return request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'logintest@example.com',
        password: 'mypassword',
      })
      .expect(201)
      .expect((res) => {
        expect(res.body).toHaveProperty('accessToken');
        expect(res.body.user.email).toBe('logintest@example.com');
      });
  });

  it('should reject invalid login', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'nonexistent@example.com',
        password: 'wrong',
      })
      .expect(401);
  });

  it('should handle forgot-password', async () => {
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        name: 'Forgot User',
        email: 'forgot@example.com',
        password: 'password123',
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'forgot@example.com' })
      .expect(201);
    expect(res.body.message).toContain('If the email exists');
  });

  it('should handle reset-password with valid token', async () => {
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        name: 'Reset User',
        email: 'reset@example.com',
        password: 'oldpassword',
      })
      .expect(201);

    const token = 'test-reset-token-123';
    const expiresAt = new Date(Date.now() + 3600000);
    await userModel.updateOne(
      { email: 'reset@example.com' },
      { passwordResetToken: token, passwordResetExpires: expiresAt },
    );

    const res = await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token, newPassword: 'newpassword123' })
      .expect(201);
    expect(res.body.message).toBe('Password has been reset successfully');

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'reset@example.com', password: 'newpassword123' })
      .expect(201);
    expect(loginRes.body.accessToken).toBeDefined();
  });
});
