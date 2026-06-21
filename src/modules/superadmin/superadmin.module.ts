import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { CoursesModule } from '../courses/courses.module';
import { SuperadminController } from './superadmin.controller';

@Module({
  imports: [AnalyticsModule, CoursesModule],
  controllers: [SuperadminController],
})
export class SuperadminModule {}
