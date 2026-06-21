import { Module } from '@nestjs/common';
import { AchievementsModule } from '../achievements/achievements.module';
import { CatalogModule } from '../catalog/catalog.module';
import { CertificatesModule } from '../certificates/certificates.module';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { PartnerApiController } from './partner-api.controller';
import { PartnerApiService } from './partner-api.service';

@Module({
  imports: [
    EnrollmentsModule,
    CertificatesModule,
    CatalogModule,
    AchievementsModule,
  ],
  controllers: [PartnerApiController],
  providers: [PartnerApiService],
  exports: [PartnerApiService],
})
export class PartnerApiModule {}
