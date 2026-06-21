import { Controller, Delete, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';
import { ParseCuidPipe } from '../../common/pipes/parse-cuid.pipe';
import { ChatService } from './chat.service';

@ApiTags('Chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('rooms/:courseId')
  @ApiOperation({ summary: 'Get room + recent messages' })
  getRoom(@Param('courseId', ParseCuidPipe) courseId: string) {
    return this.chatService.getRoom(courseId);
  }

  @Get('rooms/:courseId/history')
  @ApiOperation({ summary: 'Paginated chat history' })
  history(
    @Param('courseId', ParseCuidPipe) courseId: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.chatService.history(courseId, cursor);
  }

  @Get('direct/:userId')
  @ApiOperation({ summary: 'DM thread with user' })
  direct(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', ParseCuidPipe) userId: string,
  ) {
    return this.chatService.directThread(user.userId, userId);
  }

  @Get('direct')
  @ApiOperation({ summary: 'DM inbox' })
  inbox(@CurrentUser() user: AuthenticatedUser) {
    return this.chatService.directInbox(user.userId);
  }

  @Delete('messages/:id')
  @ApiOperation({ summary: 'Delete message' })
  deleteMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseCuidPipe) id: string,
  ) {
    const isAdmin =
      user.role === UserRole.ADMIN || user.role === UserRole.SUPERADMIN;
    return this.chatService.deleteMessage(id, user.userId, isAdmin);
  }
}
