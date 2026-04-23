import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { ValidationPipe } from '../src/common/pipes/validation.pipe';
import { EmailService } from '../src/integrations/email/email.service';

describe('Admin & quotes (integration)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
    process.env.JWT_SECRET = 'integration-admin-secret';
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

  it('admin can read analytics and settings; user quote flows to admin', async () => {
    const adminRes = await request(app.getHttpServer())
      .post('/auth/signup/admin')
      .send({
        name: 'Admin Int',
        email: 'admin-int@example.com',
        password: 'password123',
      })
      .expect(201);
    const adminToken = adminRes.body.accessToken;

    const analytics = await request(app.getHttpServer())
      .get('/admin/analytics')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(analytics.body.overview).toEqual(
      expect.objectContaining({
        totalShipments: expect.any(Number),
        totalShippers: expect.any(Number),
        totalAgents: expect.any(Number),
      }),
    );
    expect(analytics.body.quoteActivity).toBeDefined();

    const settingsGet = await request(app.getHttpServer())
      .get('/admin/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(settingsGet.body.platformName).toBeDefined();

    await request(app.getHttpServer())
      .patch('/admin/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        platformName: 'Aidport Test',
        adminEmail: 'ops@test.com',
        notifyNewShipment: false,
      })
      .expect(200);

    const userRes = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        name: 'Shipper Int',
        email: 'shipper-int@example.com',
        password: 'password123',
      })
      .expect(201);
    const userToken = userRes.body.accessToken;

    const quoteRes = await request(app.getHttpServer())
      .post('/quotes')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        originCity: 'Lagos',
        destinationCity: 'London',
        weightKg: 5,
      })
      .expect(201);
    const quoteId = quoteRes.body._id;

    const listQuotes = await request(app.getHttpServer())
      .get('/admin/quotes?status=pending')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(listQuotes.body.items.length).toBeGreaterThanOrEqual(1);

    await request(app.getHttpServer())
      .patch(`/admin/quotes/${quoteId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'approved' })
      .expect(200);

    const shippers = await request(app.getHttpServer())
      .get('/admin/shippers')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(shippers.body.items.length).toBeGreaterThanOrEqual(1);
    expect(shippers.body.items[0]).toHaveProperty('shipmentCount');
  });

  it('agent appears in admin list and can be approved', async () => {
    const adminRes = await request(app.getHttpServer())
      .post('/auth/signup/admin')
      .send({
        name: 'Admin 2',
        email: 'admin2-int@example.com',
        password: 'password123',
      })
      .expect(201);
    const adminToken = adminRes.body.accessToken;

    const agentRes = await request(app.getHttpServer())
      .post('/auth/signup/agent')
      .send({
        name: 'Agent Int',
        email: 'agent-int@example.com',
        password: 'password123',
      })
      .expect(201);
    const agentId = agentRes.body.user.id;

    await request(app.getHttpServer())
      .patch('/agent/profile')
      .set('Authorization', `Bearer ${agentRes.body.accessToken}`)
      .send({
        pricingPlan: 'premium',
        companyName: 'Int Logistics',
        dateEstablished: '2017-05-20',
        location: 'Abuja, Nigeria',
        aboutCompany: 'Admin integration test agent company profile.',
        transportModes: ['freight_forwarder', 'sea_cargo'],
      })
      .expect(200);

    const agents = await request(app.getHttpServer())
      .get('/admin/agents?agentStatus=pending_review')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(agents.body.items.some((a: { _id: string }) => a._id === agentId)).toBe(
      true,
    );

    await request(app.getHttpServer())
      .patch(`/admin/agents/${agentId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'approved' })
      .expect(200);

    const detail = await request(app.getHttpServer())
      .get(`/admin/agents/${agentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(detail.body.agentProfile?.status).toBe('approved');
  });
});
