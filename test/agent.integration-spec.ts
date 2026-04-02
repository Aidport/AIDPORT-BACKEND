import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { ValidationPipe } from '../src/common/pipes/validation.pipe';
import { EmailService } from '../src/integrations/email/email.service';

describe('Agent auth, quotes, rates (integration)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
    process.env.JWT_SECRET = 'integration-agent-secret';
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

  it('rejects non-agent on POST /auth/login/agent', async () => {
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        name: 'Only User',
        email: 'only-user@example.com',
        password: 'password123',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/login/agent')
      .send({ email: 'only-user@example.com', password: 'password123' })
      .expect(403);
  });

  it('agent login, accept approved quote, add rates on shipment', async () => {
    const adminRes = await request(app.getHttpServer())
      .post('/auth/signup/admin')
      .send({
        name: 'Admin',
        email: 'admin-agent-flow@example.com',
        password: 'password123',
      })
      .expect(201);
    const adminToken = adminRes.body.accessToken;

    const userRes = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        name: 'Shipper',
        email: 'shipper-agent-flow@example.com',
        password: 'password123',
      })
      .expect(201);
    const userToken = userRes.body.accessToken;

    const shipRes = await request(app.getHttpServer())
      .post('/shipments')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        cargoName: 'Boxes',
        category: 'other',
        originCity: 'Lagos',
        destinationCity: 'Abuja',
      })
      .expect(201);
    const shipmentId = shipRes.body._id;

    const quoteRes = await request(app.getHttpServer())
      .post('/quotes')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ shipmentId, weightKg: 10 })
      .expect(201);
    const quoteId = quoteRes.body._id;

    await request(app.getHttpServer())
      .patch(`/admin/quotes/${quoteId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'approved' })
      .expect(200);

    const agentRes = await request(app.getHttpServer())
      .post('/auth/signup/agent')
      .send({
        name: 'Agent',
        email: 'agent-flow@example.com',
        password: 'password123',
      })
      .expect(201);
    expect(agentRes.body.user.role).toBe('agent');
    const agentId = agentRes.body.user.id;
    const agentSignupToken = agentRes.body.accessToken;

    const profileRes = await request(app.getHttpServer())
      .patch('/agent/profile')
      .set('Authorization', `Bearer ${agentSignupToken}`)
      .send({
        pricingPlan: 'basic',
        companyName: 'Flow Logistics',
        dateEstablished: '2019-03-01',
        location: 'Lagos, Nigeria',
        aboutCompany: 'Integration test agent company description.',
        transportModes: ['sea', 'land'],
      })
      .expect(200);
    expect(profileRes.body.isEmailVerified).toBe(true);

    await request(app.getHttpServer())
      .patch(`/admin/agents/${agentId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'approved' })
      .expect(200);

    const loginAgent = await request(app.getHttpServer())
      .post('/auth/login/agent')
      .send({ email: 'agent-flow@example.com', password: 'password123' })
      .expect(201);
    expect(loginAgent.body.user.role).toBe('agent');

    const agentToken = loginAgent.body.accessToken;

    const openQuotes = await request(app.getHttpServer())
      .get('/agent/quotes')
      .set('Authorization', `Bearer ${agentToken}`)
      .expect(200);
    expect(openQuotes.body.items.length).toBeGreaterThanOrEqual(1);

    await request(app.getHttpServer())
      .post(`/agent/quotes/${quoteId}/accept`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ amount: 15000 })
      .expect(201);

    const rateRes = await request(app.getHttpServer())
      .patch(`/agent/shipments/${shipmentId}/rates`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({
        rates: [
          {
            type: 'local',
            originZone: 'Lagos',
            destinationZone: 'Abuja',
            price: 9000,
          },
          {
            type: 'international',
            originCountry: 'Nigeria',
            destinationCountry: 'UK',
            price: 9000,
          },
        ],
        currency: 'NGN',
        carrierName: 'Aidport Partner',
      })
      .expect(200);

    expect(rateRes.body.amount).toBe(18000);
    expect(rateRes.body.rates).toHaveLength(2);
    expect(rateRes.body.carrierName).toBe('Aidport Partner');
  });
});
