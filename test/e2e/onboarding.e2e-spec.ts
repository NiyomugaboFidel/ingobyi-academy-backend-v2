import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Onboarding & join requests (e2e)', () => {
  let app: INestApplication;
  let orgId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    const dirRes = await request(app.getHttpServer())
      .get('/api/organizations/directory')
      .expect(200);
    orgId = dirRes.body.data.data[0]?.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /organizations/directory is public for onboarding', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/organizations/directory')
      .expect(200);
    expect(res.body.data.data.length).toBeGreaterThanOrEqual(1);
    expect(orgId).toBeDefined();
  });

  it('authenticated user can submit join request with role', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'student@ingobyi.com', password: 'password123' })
      .expect(201);

    const token = loginRes.body.data.accessToken;

    const meRes = await request(app.getHttpServer())
      .get('/api/organizations/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const memberOrgIds = new Set(
      meRes.body.data.map((m: { organizationId: string }) => m.organizationId),
    );

    const targetOrg = orgId && !memberOrgIds.has(orgId) ? orgId : null;
    if (!targetOrg) return;

    const joinRes = await request(app.getHttpServer())
      .post('/api/organizations/join-requests')
      .set('Authorization', `Bearer ${token}`)
      .send({
        organizationId: targetOrg,
        requestedRole: 'TRAINER',
        message: 'I want to teach',
      });

    expect([201, 400]).toContain(joinRes.status);
    if (joinRes.status === 201) {
      expect(joinRes.body.data.requestedRole).toBe('TRAINER');
    }
  });

  it('GET /organizations/my-join-requests returns user requests', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@ingobyi.com', password: 'password123' })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get('/api/organizations/my-join-requests')
      .set('Authorization', `Bearer ${loginRes.body.data.accessToken}`)
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('admin join requests include requestedRole and user info', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@ingobyi.com', password: 'password123' })
      .expect(201);

    const orgId = loginRes.body.data.activeOrgId;
    const res = await request(app.getHttpServer())
      .get(`/api/organizations/${orgId}/join-requests`)
      .set('Authorization', `Bearer ${loginRes.body.data.accessToken}`)
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    if (res.body.data.length > 0) {
      expect(res.body.data[0].requestedRole).toBeDefined();
      expect(res.body.data[0].userEmail).toBeDefined();
    }
  });
});
