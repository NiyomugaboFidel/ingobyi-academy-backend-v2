import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ParentModule } from '../parent/parent.module';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';

@Module({
  imports: [NotificationsModule, ParentModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
