import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { ValidationPipe } from '../src/common/pipes/validation.pipe';
import { EmailService } from '../src/integrations/email/email.service';

describe('App (e2e)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const mongoUri = mongod.getUri();
    process.env.MONGODB_URI = mongoUri;
    process.env.JWT_SECRET = 'e2e-test-secret';
    process.env.JWT_EXPIRES_IN = '1h';

    const { AppModule } = await import('../src/app.module');
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
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
  }, 120000);

  afterAll(async () => {
    if (app) await app.close();
    if (mongod) await mongod.stop();
  });

  it('/ (GET) - health check', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('status', 'ok');
      });
  });

  it('/health (GET) - health endpoint', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200);
  });

  it('/agents (GET) - public list without auth', () => {
    return request(app.getHttpServer())
      .get('/agents')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('items');
        expect(res.body).toHaveProperty('meta');
        expect(Array.isArray(res.body.items)).toBe(true);
      });
  });

  it('/agents (GET) - empty optional query params do not 400', () => {
    return request(app.getHttpServer())
      .get('/agents?page=1&limit=10&search=&transportMode=')
      .expect(200);
  });

  it('/auth/signup (POST) - user registration', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        name: 'E2E User',
        email: 'e2e@example.com',
        password: 'password123',
      })
      .expect(201);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body.user.email).toBe('e2e@example.com');
  });

  it('/auth/login (POST) - user login', async () => {
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        name: 'Login User',
        email: 'login@example.com',
        password: 'password123',
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'login@example.com',
        password: 'password123',
      })
      .expect(201);
    expect(res.body).toHaveProperty('accessToken');
  });

  it('/users/me (GET) - protected route requires auth', () => {
    return request(app.getHttpServer())
      .get('/users/me')
      .expect(401);
  });

  it('/users/me (GET) - returns user with valid token', async () => {
    const signupRes = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        name: 'Profile User',
        email: 'profile@example.com',
        password: 'password123',
      })
      .expect(201);

    const token = signupRes.body.accessToken;
    return request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.email).toBe('profile@example.com');
        expect(res.body.name).toBe('Profile User');
      });
  });

  it('/auth/forgot-password (POST)', async () => {
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        name: 'Forgot User',
        email: 'forgot-e2e@example.com',
        password: 'password123',
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'forgot-e2e@example.com' });
    expect([200, 201]).toContain(res.status);
    expect(res.body).toHaveProperty('message');
  });

  it('/auth/reset-password (POST) - rejects invalid token', () => {
    return request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token: 'invalid-token', newPassword: 'newpass123' })
      .expect(400);
  });

  it('/admin/analytics (GET) - requires authentication', () => {
    return request(app.getHttpServer()).get('/admin/analytics').expect(401);
  });

  it('/admin/analytics (GET) - rejects non-admin', async () => {
    const signup = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        name: 'Regular User',
        email: 'regular-e2e@example.com',
        password: 'password123',
      })
      .expect(201);

    return request(app.getHttpServer())
      .get('/admin/analytics')
      .set('Authorization', `Bearer ${signup.body.accessToken}`)
      .expect(403);
  });

  it('/auth/login/agent (POST) - rejects user role', async () => {
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        name: 'Portal User',
        email: 'portal-user@example.com',
        password: 'password123',
      })
      .expect(201);

    return request(app.getHttpServer())
      .post('/auth/login/agent')
      .send({ email: 'portal-user@example.com', password: 'password123' })
      .expect(403);
  });

  it('/auth/login/agent (POST) - allows agent role after admin approval', async () => {
    const adminRes = await request(app.getHttpServer())
      .post('/auth/signup/admin')
      .send({
        name: 'Admin For Agent Login',
        email: 'admin-for-agent-login@example.com',
        password: 'password123',
      })
      .expect(201);
    const adminToken = adminRes.body.accessToken;

    const signup = await request(app.getHttpServer())
      .post('/auth/signup/agent')
      .send({
        name: 'Portal Agent',
        email: 'portal-agent@example.com',
        password: 'password123',
      })
      .expect(201);
    expect(signup.body.user.role).toBe('user');

    await request(app.getHttpServer())
      .post('/auth/login/agent')
      .send({ email: 'portal-agent@example.com', password: 'password123' })
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/admin/agents/${signup.body.user.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'approved' })
      .expect(200);

    const res = await request(app.getHttpServer())
      .post('/auth/login/agent')
      .send({ email: 'portal-agent@example.com', password: 'password123' })
      .expect(201);

    expect(res.body.user.role).toBe('agent');
  });

  it('/agent/me (GET) - requires agent token', async () => {
    const admin = await request(app.getHttpServer())
      .post('/auth/signup/admin')
      .send({
        name: 'Admin Gate',
        email: 'admin-gate@example.com',
        password: 'password123',
      })
      .expect(201);

    return request(app.getHttpServer())
      .get('/agent/me')
      .set('Authorization', `Bearer ${admin.body.accessToken}`)
      .expect(403);
  });

  it('/admin/analytics (GET) - allows admin', async () => {
    const admin = await request(app.getHttpServer())
      .post('/auth/signup/admin')
      .send({
        name: 'E2E Admin',
        email: 'admin-e2e@example.com',
        password: 'password123',
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get('/admin/analytics')
      .set('Authorization', `Bearer ${admin.body.accessToken}`)
      .expect(200);

    expect(res.body.overview).toEqual(
      expect.objectContaining({
        totalShipments: expect.any(Number),
        totalShippers: expect.any(Number),
        totalAgents: expect.any(Number),
      }),
    );
  });
});
