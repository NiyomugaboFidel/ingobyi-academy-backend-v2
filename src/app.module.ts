import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { ConfigurationModule } from './config/configuration.module';
import { EnvConfig } from './config/configuration';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { JwtStrategy } from './common/strategies/jwt.strategy';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health/health.controller';
import { EmailModule } from './shared/email/email.module';
import { CloudinaryModule } from './shared/cloudinary/cloudinary.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { CoursesModule } from './modules/courses/courses.module';
import { LessonsModule } from './modules/lessons/lessons.module';
import { EnrollmentsModule } from './modules/enrollments/enrollments.module';
import { ProgressModule } from './modules/progress/progress.module';
import { AssignmentsModule } from './modules/assignments/assignments.module';
import { CertificatesModule } from './modules/certificates/certificates.module';
import { ChatModule } from './modules/chat/chat.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { GatewayModule } from './modules/gateway/gateway.module';
import { CommunityModule } from './modules/community/community.module';
import { AchievementsModule } from './modules/achievements/achievements.module';
import { AnnouncementsModule } from './modules/announcements/announcements.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PhysicalModule } from './modules/physical-sessions/physical.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { ParentModule } from './modules/parent/parent.module';
import { ApiKeysModule } from './modules/api-keys/api-keys.module';
import { PartnerApiModule } from './modules/partner-api/partner-api.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { SuperadminModule } from './modules/superadmin/superadmin.module';
import { ReportsModule } from './modules/reports/reports.module';
import { WishlistModule } from './modules/wishlist/wishlist.module';
import { QuizzesModule } from './modules/quizzes/quizzes.module';
import { RoutesModule } from './routes/routes.module';
import { RbacModule } from './modules/rbac/rbac.module';

@Module({
  imports: [
    ConfigurationModule,
    PrismaModule,
    RbacModule,
    EmailModule,
    CloudinaryModule,
    AuditModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvConfig, true>) => ({
        secret: config.get('JWT_SECRET', { infer: true }),
        signOptions: {
          expiresIn: config.get('JWT_EXPIRES_IN', { infer: true }),
        },
      }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvConfig, true>) => [
        {
          ttl: config.get('THROTTLE_TTL', { infer: true }) * 1000,
          limit: config.get('THROTTLE_LIMIT', { infer: true }),
        },
      ],
    }),
    AuthModule,
    UsersModule,
    OrganizationsModule,
    CoursesModule,
    LessonsModule,
    EnrollmentsModule,
    ProgressModule,
    AssignmentsModule,
    CertificatesModule,
    ChatModule,
    MessagingModule,
    GatewayModule,
    CommunityModule,
    AchievementsModule,
    AnnouncementsModule,
    NotificationsModule,
    PhysicalModule,
    AnalyticsModule,
    ParentModule,
    ApiKeysModule,
    PartnerApiModule,
    CatalogModule,
    SuperadminModule,
    ReportsModule,
    WishlistModule,
    QuizzesModule,
    RoutesModule,
  ],
  controllers: [HealthController],
  providers: [
    JwtStrategy,
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
