import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';
import { ParseCuidPipe } from '../../common/pipes/parse-cuid.pipe';
import { ConversationsService } from './conversations.service';
import { MessagesService } from './messages.service';
import { MessagingPermissionsService } from './messaging-permissions.service';
import { PresenceService } from './presence.service';
import {
  EditMessageDto,
  ReactMessageDto,
  SendMessageDto,
} from './dto/send-message.dto';

@ApiTags('Messaging')
@Controller('messaging')
export class MessagingController {
  constructor(
    private readonly conversations: ConversationsService,
    private readonly messages: MessagesService,
    private readonly permissions: MessagingPermissionsService,
    private readonly presence: PresenceService,
  ) {}

  @Get('conversations')
  @ApiOperation({ summary: 'List conversations for current user' })
  listConversations(
    @CurrentUser() user: AuthenticatedUser,
    @Query('filter') filter?: 'archived' | 'starred' | 'all',
  ) {
    return this.conversations.listForUser(user, filter);
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get conversation details' })
  getConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseCuidPipe) id: string,
  ) {
    return this.conversations.getById(id, user.userId);
  }

  @Get('courses/:courseId/conversation')
  @ApiOperation({ summary: 'Get or create course room conversation' })
  getCourseConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('courseId', ParseCuidPipe) courseId: string,
  ) {
    return this.conversations.getByCourseId(courseId, user);
  }

  @Get('conversations/:id/attachments')
  @ApiOperation({ summary: 'Shared files in conversation' })
  sharedAttachments(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseCuidPipe) id: string,
  ) {
    return this.conversations.getSharedAttachments(id, user.userId);
  }

  @Post('conversations/direct/:userId')
  @ApiOperation({ summary: 'Get or create direct conversation' })
  createDirect(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', ParseCuidPipe) otherUserId: string,
  ) {
    return this.conversations.getOrCreateDirectConversation(user, otherUserId);
  }

  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'List messages in conversation' })
  listMessages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseCuidPipe) id: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.messages.listMessages(
      id,
      user,
      cursor,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Post('conversations/:id/messages')
  @ApiOperation({ summary: 'Send message' })
  sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.messages.sendMessage(id, user, dto);
  }

  @Patch('messages/:id')
  @ApiOperation({ summary: 'Edit message' })
  editMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: EditMessageDto,
  ) {
    return this.messages.editMessage(id, user, dto.content, dto.plainText);
  }

  @Delete('messages/:id')
  @ApiOperation({ summary: 'Delete message' })
  deleteMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseCuidPipe) id: string,
  ) {
    return this.messages.deleteMessage(id, user);
  }

  @Post('messages/:id/react')
  @ApiOperation({ summary: 'React to message' })
  react(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: ReactMessageDto,
  ) {
    return this.messages.react(id, user, dto.emoji);
  }

  @Delete('messages/:id/react')
  @ApiOperation({ summary: 'Remove reaction' })
  unreact(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseCuidPipe) id: string,
    @Query('emoji') emoji: string,
  ) {
    return this.messages.unreact(id, user, emoji);
  }

  @Post('conversations/:id/read')
  @ApiOperation({ summary: 'Mark conversation as read' })
  markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseCuidPipe) id: string,
    @Query('messageId') messageId?: string,
  ) {
    return this.messages.markRead(id, user, messageId);
  }

  @Post('conversations/:id/pin/:messageId')
  @ApiOperation({ summary: 'Pin message' })
  pin(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseCuidPipe) id: string,
    @Param('messageId', ParseCuidPipe) messageId: string,
  ) {
    return this.messages.pinMessage(id, messageId, user);
  }

  @Patch('conversations/:id/archive')
  @ApiOperation({ summary: 'Archive/unarchive conversation' })
  archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseCuidPipe) id: string,
    @Body('archived') archived: boolean,
  ) {
    return this.conversations.setArchived(id, user.userId, archived);
  }

  @Patch('conversations/:id/star')
  @ApiOperation({ summary: 'Star/unstar conversation' })
  star(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseCuidPipe) id: string,
    @Body('starred') starred: boolean,
  ) {
    return this.conversations.setStarred(id, user.userId, starred);
  }

  @Patch('conversations/:id/mute')
  @ApiOperation({ summary: 'Mute/unmute conversation' })
  mute(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseCuidPipe) id: string,
    @Body('muted') muted: boolean,
  ) {
    return this.conversations.setMuted(id, user.userId, muted);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Total unread message count' })
  unreadCount(@CurrentUser() user: AuthenticatedUser) {
    return this.conversations.getUnreadCount(user.userId);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search messages' })
  search(@CurrentUser() user: AuthenticatedUser, @Query('q') q: string) {
    return this.messages.searchMessages(user, q);
  }

  @Get('contacts')
  @ApiOperation({ summary: 'Users the current user can message' })
  contacts(@CurrentUser() user: AuthenticatedUser) {
    return this.permissions.getMessageableContacts(user);
  }

  @Get('presence')
  @ApiOperation({ summary: 'Presence for user IDs' })
  getPresence(@Query('ids') ids: string) {
    const userIds = ids.split(',').filter(Boolean);
    return this.presence.getPresence(userIds);
  }

  @Get('presence/stats')
  @ApiOperation({ summary: 'Online / away user counts' })
  getPresenceStats(@Query('orgId') orgId?: string) {
    return this.presence.getStats(orgId || undefined);
  }

  @Get('conversations/:id/pinned')
  @ApiOperation({ summary: 'Pinned messages in conversation' })
  pinned(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseCuidPipe) id: string,
  ) {
    return this.messages.getPinned(id, user);
  }

  @Post('messages/:id/star')
  @ApiOperation({ summary: 'Star/unstar message' })
  starMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseCuidPipe) id: string,
    @Body('starred') starred: boolean,
  ) {
    return this.messages.starMessage(id, user, starred);
  }

  @Get('messages/:id/thread')
  @ApiOperation({ summary: 'Thread replies for a message' })
  threadReplies(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseCuidPipe) id: string,
  ) {
    return this.messages.listThreadReplies(id, user);
  }
}
