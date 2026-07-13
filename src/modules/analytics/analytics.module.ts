import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { TrainerReportPdfService } from './trainer-report-pdf.service';

@Module({
  imports: [PrismaModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, TrainerReportPdfService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
