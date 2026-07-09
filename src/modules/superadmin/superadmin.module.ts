import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { CoursesModule } from '../courses/courses.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ParentModule } from '../parent/parent.module';
import { SuperadminController } from './superadmin.controller';

@Module({
  imports: [AnalyticsModule, CoursesModule, ParentModule, OrganizationsModule],
  controllers: [SuperadminController],
})
export class SuperadminModule {}
