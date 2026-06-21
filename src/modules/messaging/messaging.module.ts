import { Module } from '@nestjs/common';
import { MessagingController } from './messaging.controller';
import { ConversationsService } from './conversations.service';
import { MessagesService } from './messages.service';
import { MessagingPermissionsService } from './messaging-permissions.service';
import { PresenceService } from './presence.service';

@Module({
  controllers: [MessagingController],
  providers: [
    ConversationsService,
    MessagesService,
    MessagingPermissionsService,
    PresenceService,
  ],
  exports: [
    ConversationsService,
    MessagesService,
    MessagingPermissionsService,
    PresenceService,
  ],
})
export class MessagingModule {}
