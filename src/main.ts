import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { EnvConfig } from './config/configuration';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  const config = app.get(ConfigService<EnvConfig, true>);
  const port = config.get('PORT', { infer: true });
  const frontendUrl = config.get('FRONTEND_URL', { infer: true });
  const nodeEnv = config.get('NODE_ENV', { infer: true });

  app.setGlobalPrefix('api');
  if (nodeEnv === 'production' || nodeEnv === 'staging') {
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }
  app.use(helmet());
  app.use(cookieParser());
  const corsStrict = nodeEnv === 'production' || nodeEnv === 'staging';
  app.enableCors({
    origin: corsStrict ? frontendUrl : true,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const enableSwagger =
    config.get('ENABLE_SWAGGER', { infer: true }) ||
    nodeEnv === 'development' ||
    nodeEnv === 'staging';

  if (enableSwagger) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Ingobyi Academy API')
      .setDescription(
        [
          'REST API for Ingobyi Academy — multi-tenant learning for schools, training centers, and organizations.',
          '',
          '**Authentication**',
          '- Most routes require `Authorization: Bearer <accessToken>` from `/auth/login` or `/auth/verify-otp`.',
          '- Refresh sessions use the `ia_refresh` httpOnly cookie on `/auth/refresh`.',
          '',
          '**Errors**',
          '- Failed requests return `{ success: false, message, statusCode }` with a user-safe message.',
        ].join('\n'),
      )
      .setVersion('1.0.0')
      .setContact('Ingobyi Academy', frontendUrl, 'support@ingobyi.com')
      .addServer(`http://localhost:${port}/api`, 'Local development')
      .addServer(
        frontendUrl.replace(/:\d+$/, `:${port}`) + '/api',
        'Configured host',
      )
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Access token from login or refresh',
        },
        'access-token',
      )
      .addApiKey(
        {
          type: 'apiKey',
          name: 'X-API-Key',
          in: 'header',
          description: 'Partner API key (partner routes only)',
        },
        'api-key',
      )
      .addTag('Auth', 'Sign in, registration, tokens, and workspace switching')
      .addTag('Courses', 'Course catalog, creation, and approvals')
      .addTag('Enrollments', 'Learner enrollment and access')
      .addTag('Progress', 'Lesson progress and completion')
      .addTag('Certificates', 'Certificate requests and verification')
      .addTag('Community', 'Social feed and connections')
      .addTag('Health', 'Service health checks')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig, {
      operationIdFactory: (_controllerKey, methodKey) => methodKey,
    });

    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'none',
        filter: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
      customSiteTitle: 'Ingobyi Academy API Docs',
    });

    console.log(`Swagger docs:  http://localhost:${port}/api/docs`);
  }

  await app.listen(port, '0.0.0.0');
  console.log(`Ingobyi Academy API running on port ${port} (${nodeEnv})`);
  console.log(`Route index:   http://localhost:${port}/api/routes`);
}

bootstrap();
