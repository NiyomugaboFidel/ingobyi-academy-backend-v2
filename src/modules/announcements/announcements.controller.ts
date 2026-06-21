import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';
import { ParseCuidPipe } from '../../common/pipes/parse-cuid.pipe';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';

@ApiTags('Announcements')
@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Get()
  @ApiOperation({ summary: 'My relevant announcements' })
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.announcementsService.mine(user.userId);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Unread announcement count' })
  unreadCount(@CurrentUser() user: AuthenticatedUser) {
    return this.announcementsService.unreadCount(user.userId);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.TRAINER)
  @ApiOperation({ summary: 'Create announcement' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAnnouncementDto,
  ) {
    return this.announcementsService.create(user, dto);
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark announcement as read' })
  markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseCuidPipe) id: string,
  ) {
    return this.announcementsService.markRead(id, user.userId);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Update announcement' })
  update(
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: Partial<CreateAnnouncementDto>,
  ) {
    return this.announcementsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Delete announcement' })
  remove(@Param('id', ParseCuidPipe) id: string) {
    return this.announcementsService.remove(id);
  }
}
