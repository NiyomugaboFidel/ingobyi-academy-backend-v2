import { Injectable, NotFoundException } from '@nestjs/common';
import { ConversationType, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';
import { MessagingPermissionsService } from './messaging-permissions.service';

const userSelect = {
  id: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  platformRole: true,
  lastSeenAt: true,
} as const;

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: MessagingPermissionsService,
  ) {}

  async getByCourseId(courseId: string, user: AuthenticatedUser) {
    await this.permissions.assertCourseRoomAccess(
      user.userId,
      user.role,
      courseId,
    );
    const conv = await this.ensureCourseConversation(courseId);
    await this.ensureParticipant(conv.id, user.userId);
    return this.getById(conv.id, user.userId);
  }

  async getSharedAttachments(conversationId: string, userId: string) {
    await this.getById(conversationId, userId);
    return this.prisma.messageAttachment.findMany({
      where: { message: { conversationId, deletedAt: null } },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        message: {
          select: {
            id: true,
            sender: { select: userSelect },
            createdAt: true,
          },
        },
      },
    });
  }

  async ensureCourseConversation(courseId: string, title?: string) {
    const existing = await this.prisma.conversation.findUnique({
      where: { courseId },
    });
    if (existing) return existing;

    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, title: true, orgId: true },
    });
    if (!course) throw new NotFoundException('Course not found');

    return this.prisma.conversation.create({
      data: {
        type: ConversationType.COURSE_ROOM,
        courseId: course.id,
        orgId: course.orgId,
        title: title ?? course.title,
      },
    });
  }

  async getOrCreateDirectConversation(
    user: AuthenticatedUser,
    otherUserId: string,
  ) {
    await this.permissions.assertDirectMessaging(
      user.userId,
      user.role,
      otherUserId,
    );

    const candidates = await this.prisma.conversation.findMany({
      where: {
        type: ConversationType.DIRECT,
        participants: { some: { userId: user.userId } },
      },
      include: {
        participants: { include: { user: { select: userSelect } } },
        messages: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { sender: { select: userSelect } },
        },
      },
    });

    const existing = candidates.find(
      (c) =>
        c.participants.length === 2 &&
        c.participants.some((p) => p.userId === otherUserId),
    );

    if (existing) return this.formatConversation(existing, user.userId);

    const other = await this.prisma.user.findUnique({
      where: { id: otherUserId },
      select: userSelect,
    });
    if (!other) throw new NotFoundException('User not found');

    const conversation = await this.prisma.conversation.create({
      data: {
        type: ConversationType.DIRECT,
        title: `${other.firstName} ${other.lastName}`,
        participants: {
          create: [{ userId: user.userId }, { userId: otherUserId }],
        },
      },
      include: {
        participants: { include: { user: { select: userSelect } } },
        messages: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { sender: { select: userSelect } },
        },
      },
    });

    return this.formatConversation(conversation, user.userId);
  }

  async listForUser(
    user: AuthenticatedUser,
    filter?: 'archived' | 'starred' | 'all',
  ) {
    const participantWhere =
      filter === 'archived'
        ? { isArchived: true }
        : filter === 'starred'
          ? { isStarred: true }
          : { isArchived: false };

    const participants = await this.prisma.conversationParticipant.findMany({
      where: { userId: user.userId, ...participantWhere },
      include: {
        conversation: {
          include: {
            course: {
              select: { id: true, title: true, slug: true, thumbnailUrl: true },
            },
            participants: { include: { user: { select: userSelect } } },
            messages: {
              where: { deletedAt: null },
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: {
                sender: { select: userSelect },
                reactions: true,
              },
            },
            typing: { where: { expiresAt: { gt: new Date() } } },
          },
        },
      },
      orderBy: { conversation: { updatedAt: 'desc' } },
    });

    const archivedOnly = filter === 'archived';
    const courseConversations = await this.getCourseRoomsForUser(
      user,
      archivedOnly,
    );

    const direct = this.dedupeDirectConversations(
      participants
        .filter((p) => p.conversation.type === ConversationType.DIRECT)
        .map((p) => this.formatConversation(p.conversation, user.userId, p)),
    );

    const courseRooms = courseConversations.map((c) =>
      this.formatConversation(
        c,
        user.userId,
        c.participants.find((p) => p.userId === user.userId),
      ),
    );

    if (archivedOnly) {
      return [...courseRooms, ...direct].sort((a, b) => {
        const at = a.lastMessage?.createdAt ?? a.updatedAt;
        const bt = b.lastMessage?.createdAt ?? b.updatedAt;
        return new Date(bt).getTime() - new Date(at).getTime();
      });
    }

    const merged = [...courseRooms, ...direct];
    merged.sort((a, b) => {
      const at = a.lastMessage?.createdAt ?? a.updatedAt;
      const bt = b.lastMessage?.createdAt ?? b.updatedAt;
      return new Date(bt).getTime() - new Date(at).getTime();
    });

    return merged;
  }

  private async getCourseRoomsForUser(
    user: AuthenticatedUser,
    archivedOnly = false,
  ) {
    let courseIds: string[] = [];

    if (user.role === UserRole.SUPERADMIN) {
      const courses = await this.prisma.course.findMany({
        where: { status: 'PUBLISHED' },
        select: { id: true },
        take: 50,
      });
      courseIds = courses.map((c) => c.id);
    } else if (user.role === UserRole.ADMIN) {
      const orgs = await this.prisma.membership.findMany({
        where: { userId: user.userId, role: UserRole.ADMIN, status: 'ACTIVE' },
        select: { orgId: true },
      });
      const courses = await this.prisma.course.findMany({
        where: { orgId: { in: orgs.map((o) => o.orgId) } },
        select: { id: true },
      });
      courseIds = courses.map((c) => c.id);
    } else {
      const [enrolled, teaching] = await Promise.all([
        this.prisma.enrollment.findMany({
          where: { userId: user.userId, status: 'ACTIVE' },
          select: { courseId: true },
        }),
        this.prisma.courseTrainer.findMany({
          where: { userId: user.userId },
          select: { courseId: true },
        }),
      ]);
      courseIds = [
        ...new Set([
          ...enrolled.map((e) => e.courseId),
          ...teaching.map((t) => t.courseId),
        ]),
      ];
    }

    const conversations = await Promise.all(
      courseIds.map(async (courseId) => {
        const conv = await this.ensureCourseConversation(courseId);
        await this.ensureParticipant(conv.id, user.userId);
        return this.prisma.conversation.findUnique({
          where: { id: conv.id },
          include: {
            course: {
              select: { id: true, title: true, slug: true, thumbnailUrl: true },
            },
            participants: { include: { user: { select: userSelect } } },
            messages: {
              where: { deletedAt: null },
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: { sender: { select: userSelect }, reactions: true },
            },
            typing: { where: { expiresAt: { gt: new Date() } } },
          },
        });
      }),
    );

    return (
      conversations.filter(Boolean) as NonNullable<(typeof conversations)[0]>[]
    ).filter((conv) => {
      const participant = conv.participants.find(
        (p) => p.userId === user.userId,
      );
      const isArchived = participant?.isArchived ?? false;
      return archivedOnly ? isArchived : !isArchived;
    });
  }

  async ensureParticipant(conversationId: string, userId: string) {
    return this.prisma.conversationParticipant.upsert({
      where: { conversationId_userId: { conversationId, userId } },
      create: { conversationId, userId },
      update: {},
    });
  }

  async getById(
    conversationId: string,
    userId: string,
  ): Promise<ReturnType<ConversationsService['formatConversation']>> {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
      include: {
        conversation: {
          include: {
            course: {
              select: { id: true, title: true, slug: true, thumbnailUrl: true },
            },
            participants: { include: { user: { select: userSelect } } },
          },
        },
      },
    });

    if (!participant) {
      const conv = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { course: true },
      });
      if (conv?.courseId) {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
        });
        if (user) {
          await this.permissions.assertCourseRoomAccess(
            userId,
            user.platformRole,
            conv.courseId,
          );
          await this.ensureParticipant(conversationId, userId);
          return this.getById(conversationId, userId);
        }
      }
      throw new NotFoundException('Conversation not found');
    }

    return this.formatConversation(
      participant.conversation,
      userId,
      participant,
    );
  }

  async setArchived(conversationId: string, userId: string, archived: boolean) {
    return this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { isArchived: archived },
    });
  }

  async setStarred(conversationId: string, userId: string, starred: boolean) {
    return this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { isStarred: starred },
    });
  }

  async setMuted(conversationId: string, userId: string, muted: boolean) {
    return this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { isMuted: muted },
    });
  }

  async getUnreadCount(userId: string) {
    const result = await this.prisma.conversationParticipant.aggregate({
      where: { userId, isArchived: false },
      _sum: { unreadCount: true },
    });
    return result._sum.unreadCount ?? 0;
  }

  private dedupeDirectConversations<
    T extends {
      id: string;
      otherUser?: { id: string } | null;
      updatedAt: Date;
      lastMessage?: { createdAt: Date } | null;
    },
  >(conversations: T[]): T[] {
    const byOther = new Map<string, T>();
    for (const conv of conversations) {
      const key = conv.otherUser?.id ?? conv.id;
      const existing = byOther.get(key);
      if (!existing) {
        byOther.set(key, conv);
        continue;
      }
      const convTime = new Date(
        conv.lastMessage?.createdAt ?? conv.updatedAt,
      ).getTime();
      const existingTime = new Date(
        existing.lastMessage?.createdAt ?? existing.updatedAt,
      ).getTime();
      if (convTime > existingTime) byOther.set(key, conv);
    }
    return Array.from(byOther.values());
  }

  private formatConversation(
    conversation: {
      id: string;
      type: ConversationType;
      title: string | null;
      courseId: string | null;
      updatedAt: Date;
      course?: {
        id: string;
        title: string;
        slug: string;
        thumbnailUrl: string | null;
      } | null;
      participants: Array<{
        userId: string;
        unreadCount?: number;
        isMuted?: boolean;
        isArchived?: boolean;
        isStarred?: boolean;
        user: {
          id: string;
          firstName: string;
          lastName: string;
          avatarUrl: string | null;
          platformRole: UserRole;
          lastSeenAt: Date | null;
        };
      }>;
      messages?: Array<{
        id: string;
        plainText: string;
        content: string;
        createdAt: Date;
        senderId: string;
        isAnnouncement?: boolean;
        sender: {
          id: string;
          firstName: string;
          lastName: string;
          avatarUrl: string | null;
        };
        reactions?: Array<{ emoji: string; userId: string }>;
      }>;
      typing?: Array<{ userId: string }>;
    },
    currentUserId: string,
    participant?: {
      unreadCount: number;
      isMuted: boolean;
      isArchived: boolean;
      isStarred: boolean;
    },
  ) {
    const others = conversation.participants.filter(
      (p) => p.userId !== currentUserId,
    );
    const displayName =
      conversation.type === ConversationType.COURSE_ROOM
        ? (conversation.course?.title ?? conversation.title ?? 'Course room')
        : others[0]
          ? `${others[0].user.firstName} ${others[0].user.lastName}`
          : (conversation.title ?? 'Conversation');

    const lastMessage = conversation.messages?.[0] ?? null;

    return {
      id: conversation.id,
      type: conversation.type,
      title: displayName,
      courseId: conversation.courseId,
      course: conversation.course,
      participants: conversation.participants.map((p) => ({
        ...p.user,
        unreadCount: p.unreadCount,
      })),
      otherUser:
        conversation.type === ConversationType.DIRECT ? others[0]?.user : null,
      lastMessage: lastMessage
        ? {
            id: lastMessage.id,
            plainText: lastMessage.plainText,
            content: lastMessage.content,
            createdAt: lastMessage.createdAt,
            senderId: lastMessage.senderId,
            sender: lastMessage.sender,
            isAnnouncement: lastMessage.isAnnouncement,
          }
        : null,
      unreadCount: participant?.unreadCount ?? 0,
      isMuted: participant?.isMuted ?? false,
      isArchived: participant?.isArchived ?? false,
      isStarred: participant?.isStarred ?? false,
      typingUsers: (conversation.typing ?? [])
        .map((t) => t.userId)
        .filter((id) => id !== currentUserId),
      updatedAt: conversation.updatedAt,
    };
  }
}
