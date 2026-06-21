import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ConversationType, NotificationType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';
import { NotificationsService } from '../notifications/notifications.service';
import { MessagingPermissionsService } from './messaging-permissions.service';
import { ConversationsService } from './conversations.service';

const userSelect = {
  id: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  platformRole: true,
} as const;

@Injectable()
export class MessagesService implements OnModuleInit {
  private notifications!: NotificationsService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: MessagingPermissionsService,
    private readonly conversations: ConversationsService,
    private readonly moduleRef: ModuleRef,
  ) {}

  onModuleInit() {
    this.notifications = this.moduleRef.get(NotificationsService, {
      strict: false,
    });
  }

  stripHtml(content: string): string {
    return content
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private messageInclude(userId: string) {
    return {
      sender: { select: userSelect },
      reactions: { include: { user: { select: userSelect } } },
      attachments: true,
      readReceipts: { where: { userId } },
      replyTo: {
        select: { id: true, plainText: true, sender: { select: userSelect } },
      },
      stars: { where: { userId } },
    } as const;
  }

  async listMessages(
    conversationId: string,
    user: AuthenticatedUser,
    cursor?: string,
    limit = 50,
  ) {
    await this.conversations.getById(conversationId, user.userId);

    const messages = await this.prisma.message.findMany({
      where: {
        conversationId,
        deletedAt: null,
        threadRootId: null,
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: this.messageInclude(user.userId),
    });

    const reversed = messages.reverse();
    const withCounts = await Promise.all(
      reversed.map(async (m) => {
        const threadCount = await this.prisma.message.count({
          where: { threadRootId: m.id, deletedAt: null },
        });
        return { ...m, threadCount };
      }),
    );
    return withCounts;
  }

  async listThreadReplies(messageId: string, user: AuthenticatedUser) {
    const root = await this.prisma.message.findUnique({
      where: { id: messageId },
    });
    if (!root || root.deletedAt)
      throw new NotFoundException('Message not found');
    await this.conversations.getById(root.conversationId, user.userId);

    const [rootMessage, replies] = await Promise.all([
      this.prisma.message.findUnique({
        where: { id: messageId },
        include: this.messageInclude(user.userId),
      }),
      this.prisma.message.findMany({
        where: { threadRootId: messageId, deletedAt: null },
        orderBy: { createdAt: 'asc' },
        include: this.messageInclude(user.userId),
      }),
    ]);

    return { root: rootMessage, replies };
  }

  async sendMessage(
    conversationId: string,
    user: AuthenticatedUser,
    data: {
      content: string;
      plainText?: string;
      replyToId?: string;
      threadRootId?: string;
      isAnnouncement?: boolean;
      mentionIds?: string[];
      attachments?: Array<{
        url: string;
        mimeType: string;
        filename: string;
        size?: number;
      }>;
    },
  ) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { participants: true },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');

    const plainText = data.plainText ?? this.stripHtml(data.content);

    if (
      conversation.type === ConversationType.COURSE_ROOM &&
      conversation.courseId
    ) {
      await this.permissions.assertCanPostInCourseRoom(
        user.userId,
        user.role,
        conversation.courseId,
        data.isAnnouncement,
      );
    } else if (conversation.type === ConversationType.DIRECT) {
      const other = conversation.participants.find(
        (p) => p.userId !== user.userId,
      );
      if (other) {
        await this.permissions.assertDirectMessaging(
          user.userId,
          user.role,
          other.userId,
        );
      }
    }

    await this.conversations.ensureParticipant(conversationId, user.userId);

    let threadRootId = data.threadRootId ?? null;
    if (data.replyToId && !threadRootId) {
      const parent = await this.prisma.message.findUnique({
        where: { id: data.replyToId },
      });
      if (parent?.threadRootId) threadRootId = parent.threadRootId;
    }

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId: user.userId,
        content: data.content,
        plainText,
        replyToId: data.replyToId,
        threadRootId,
        isAnnouncement: data.isAnnouncement ?? false,
        attachments: data.attachments?.length
          ? { create: data.attachments }
          : undefined,
        mentions: data.mentionIds?.length
          ? { create: data.mentionIds.map((userId) => ({ userId })) }
          : undefined,
      },
      include: {
        ...this.messageInclude(user.userId),
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    const otherParticipants = conversation.participants.filter(
      (p) => p.userId !== user.userId,
    );
    for (const p of otherParticipants) {
      await this.prisma.conversationParticipant.update({
        where: { conversationId_userId: { conversationId, userId: p.userId } },
        data: { unreadCount: { increment: 1 } },
      });

      if (!data.isAnnouncement) {
        await this.notifications.create(
          p.userId,
          NotificationType.MESSAGE_RECEIVED,
          `New message from ${message.sender.firstName}`,
          plainText.slice(0, 120),
          `/messages?conversation=${conversationId}`,
        );
      }
    }

    return message;
  }

  async editMessage(
    messageId: string,
    user: AuthenticatedUser,
    content: string,
    plainText?: string,
  ) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });
    if (!message || message.deletedAt)
      throw new NotFoundException('Message not found');
    if (message.senderId !== user.userId)
      throw new ForbiddenException('You can only edit your own messages');

    return this.prisma.message.update({
      where: { id: messageId },
      data: {
        content,
        plainText: plainText ?? this.stripHtml(content),
        editedAt: new Date(),
      },
      include: {
        sender: { select: userSelect },
        reactions: true,
        attachments: true,
      },
    });
  }

  async deleteMessage(messageId: string, user: AuthenticatedUser) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { conversation: true },
    });
    if (!message || message.deletedAt)
      throw new NotFoundException('Message not found');

    await this.permissions.assertCanDeleteMessage(
      user.userId,
      user.role,
      message.senderId,
      message.conversation,
    );

    return this.prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
    });
  }

  async react(messageId: string, user: AuthenticatedUser, emoji: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });
    if (!message || message.deletedAt)
      throw new NotFoundException('Message not found');

    await this.conversations.getById(message.conversationId, user.userId);

    return this.prisma.messageReaction.upsert({
      where: {
        messageId_userId_emoji: { messageId, userId: user.userId, emoji },
      },
      create: { messageId, userId: user.userId, emoji },
      update: {},
      include: { user: { select: userSelect } },
    });
  }

  async unreact(messageId: string, user: AuthenticatedUser, emoji: string) {
    return this.prisma.messageReaction.deleteMany({
      where: { messageId, userId: user.userId, emoji },
    });
  }

  async markRead(
    conversationId: string,
    user: AuthenticatedUser,
    messageId?: string,
  ) {
    await this.conversations.getById(conversationId, user.userId);

    const unreadMessages = await this.prisma.message.findMany({
      where: {
        conversationId,
        senderId: { not: user.userId },
        deletedAt: null,
        readReceipts: { none: { userId: user.userId } },
        ...(messageId ? { id: messageId } : {}),
      },
      select: { id: true },
    });

    if (unreadMessages.length) {
      await this.prisma.messageReadReceipt.createMany({
        data: unreadMessages.map((m) => ({
          messageId: m.id,
          userId: user.userId,
        })),
        skipDuplicates: true,
      });
    }

    await this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId: user.userId } },
      data: { unreadCount: 0, lastReadAt: new Date() },
    });

    return { read: unreadMessages.length };
  }

  async pinMessage(
    conversationId: string,
    messageId: string,
    user: AuthenticatedUser,
  ) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');

    await this.permissions.assertCanPin(
      user.userId,
      user.role,
      conversation.courseId,
    );

    await this.prisma.pinnedMessage.upsert({
      where: { conversationId_messageId: { conversationId, messageId } },
      create: { conversationId, messageId, pinnedBy: user.userId },
      update: { pinnedAt: new Date() },
    });

    return this.prisma.message.update({
      where: { id: messageId },
      data: { isPinned: true },
    });
  }

  async starMessage(
    messageId: string,
    user: AuthenticatedUser,
    starred: boolean,
  ) {
    if (starred) {
      return this.prisma.starredMessage.upsert({
        where: { userId_messageId: { userId: user.userId, messageId } },
        create: { userId: user.userId, messageId },
        update: {},
      });
    }
    return this.prisma.starredMessage.deleteMany({
      where: { userId: user.userId, messageId },
    });
  }

  async searchMessages(user: AuthenticatedUser, query: string) {
    const participations = await this.prisma.conversationParticipant.findMany({
      where: { userId: user.userId },
      select: { conversationId: true },
    });
    const conversationIds = participations.map((p) => p.conversationId);

    return this.prisma.message.findMany({
      where: {
        conversationId: { in: conversationIds },
        deletedAt: null,
        plainText: { contains: query, mode: 'insensitive' },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        sender: { select: userSelect },
        conversation: {
          select: { id: true, type: true, title: true, courseId: true },
        },
      },
    });
  }

  async getPinned(conversationId: string, user: AuthenticatedUser) {
    await this.conversations.getById(conversationId, user.userId);
    const pins = await this.prisma.pinnedMessage.findMany({
      where: { conversationId },
      include: {
        message: {
          include: { sender: { select: userSelect } },
        },
      },
      orderBy: { pinnedAt: 'desc' },
    });
    return pins.map((p) => p.message);
  }
}
