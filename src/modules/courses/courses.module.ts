import { Module, forwardRef } from '@nestjs/common';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequireOrgGuard } from '../../common/guards/require-org.guard';
import { MessagingModule } from '../messaging/messaging.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';

@Module({
  imports: [forwardRef(() => MessagingModule), NotificationsModule],
  controllers: [CoursesController],
  providers: [CoursesService, RequireOrgGuard, PermissionsGuard],
  exports: [CoursesService],
})
export class CoursesModule {}
