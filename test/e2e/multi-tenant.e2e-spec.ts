import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Multi-tenant workspaces (e2e)', () => {
  let app: INestApplication;

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
  });

  afterAll(async () => {
    await app.close();
  });

  async function login(email: string) {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: 'password123' })
      .expect(201);
    return res.body.data as {
      accessToken: string;
      activeOrgId: string | null;
      activeOrgRole: string | null;
      user: { memberships?: Array<{ org: { id: string; name: string } }> };
    };
  }

  it('login issues JWT with active workspace for multi-org user', async () => {
    const data = await login('admin@ingobyi.com');
    expect(data.accessToken).toBeDefined();
    expect(data.activeOrgId).toBeDefined();
    expect(data.activeOrgRole).toBeDefined();
    expect((data.user.memberships?.length ?? 0) >= 2).toBe(true);
  });

  it('GET /auth/me returns active workspace', async () => {
    const { accessToken } = await login('admin@ingobyi.com');
    const res = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.data.activeOrgId).toBeDefined();
    expect(res.body.data.activeOrgRole).toBeDefined();
  });

  it('GET /organizations/me lists memberships for workspace picker', async () => {
    const { accessToken } = await login('admin@ingobyi.com');
    const res = await request(app.getHttpServer())
      .get('/api/organizations/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });

  it('switch-org changes activeOrgId and orgRole in token context', async () => {
    const loginData = await login('admin@ingobyi.com');
    const otherOrg = loginData.user.memberships?.find(
      (m) => m.org.id !== loginData.activeOrgId,
    );
    expect(otherOrg).toBeDefined();

    const switchRes = await request(app.getHttpServer())
      .post('/api/auth/switch-org')
      .set('Authorization', `Bearer ${loginData.accessToken}`)
      .send({ organizationId: otherOrg!.org.id })
      .expect(201);

    expect(switchRes.body.data.activeOrgId).toBe(otherOrg!.org.id);
    expect(switchRes.body.data.activeOrgRole).toBe('STUDENT');

    const meRes = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${switchRes.body.data.accessToken}`)
      .expect(200);

    expect(meRes.body.data.activeOrgId).toBe(otherOrg!.org.id);
    expect(meRes.body.data.activeOrgRole).toBe('STUDENT');
  });

  it('superadmin can list all organizations', async () => {
    const { accessToken } = await login('super@ingobyi.com');
    const res = await request(app.getHttpServer())
      .get('/api/organizations')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.data.data.length).toBeGreaterThanOrEqual(2);
  });
});
