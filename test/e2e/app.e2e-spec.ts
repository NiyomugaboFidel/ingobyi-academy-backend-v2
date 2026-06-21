import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Ingobyi Academy API (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;

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

  describe('Public endpoints', () => {
    it('GET /api/health', () => {
      return request(app.getHttpServer())
        .get('/api/health')
        .expect(200)
        .expect((res) => {
          expect(res.body.data.status).toBe('ok');
        });
    });

    it('GET /api/routes', () => {
      return request(app.getHttpServer())
        .get('/api/routes')
        .expect(200)
        .expect((res) => {
          expect(res.body.data.total).toBeGreaterThan(50);
          expect(Array.isArray(res.body.data.routes)).toBe(true);
        });
    });

    it('GET /api/catalog', () => {
      return request(app.getHttpServer())
        .get('/api/catalog')
        .expect(200)
        .expect((res) => {
          expect(res.body.data.data).toBeDefined();
          expect(res.body.data.meta).toBeDefined();
        });
    });

    it('GET /api/catalog/categories', () => {
      return request(app.getHttpServer())
        .get('/api/catalog/categories')
        .expect(200);
    });

    it('GET /api/catalog/featured', () => {
      return request(app.getHttpServer())
        .get('/api/catalog/featured')
        .expect(200);
    });
  });

  describe('Auth flow', () => {
    it('POST /api/auth/login — superadmin', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'super@ingobyi.com', password: 'password123' })
        .expect(201);

      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user.email).toBe('super@ingobyi.com');
      accessToken = res.body.data.accessToken;
    });

    it('GET /api/users/me — authenticated', () => {
      return request(app.getHttpServer())
        .get('/api/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.email).toBe('super@ingobyi.com');
          expect(res.body.data.passwordHash).toBeUndefined();
        });
    });

    it('GET /api/organizations — authenticated', () => {
      return request(app.getHttpServer())
        .get('/api/organizations')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.data).toBeDefined();
        });
    });

    it('GET /api/enrollments/my', () => {
      return request(app.getHttpServer())
        .get('/api/enrollments/my')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });

    it('GET /api/superadmin/stats', () => {
      return request(app.getHttpServer())
        .get('/api/superadmin/stats')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.users).toBeGreaterThanOrEqual(1);
        });
    });

    it('POST /api/auth/logout', () => {
      return request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);
    });
  });

  describe('Protected without token', () => {
    it('GET /api/users/me — 401', () => {
      return request(app.getHttpServer()).get('/api/users/me').expect(401);
    });
  });
});
