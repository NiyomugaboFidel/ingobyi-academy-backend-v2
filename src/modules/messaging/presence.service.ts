import { Injectable } from '@nestjs/common';
import { MembershipStatus, PresenceStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PresenceService {
  constructor(private readonly prisma: PrismaService) {}

  async setOnline(userId: string) {
    return this.prisma.userPresence.upsert({
      where: { userId },
      create: { userId, status: PresenceStatus.ONLINE, lastSeenAt: new Date() },
      update: { status: PresenceStatus.ONLINE, lastSeenAt: new Date() },
    });
  }

  async setOffline(userId: string) {
    return this.prisma.userPresence.upsert({
      where: { userId },
      create: {
        userId,
        status: PresenceStatus.OFFLINE,
        lastSeenAt: new Date(),
      },
      update: { status: PresenceStatus.OFFLINE, lastSeenAt: new Date() },
    });
  }

  async setAway(userId: string) {
    return this.prisma.userPresence.upsert({
      where: { userId },
      create: { userId, status: PresenceStatus.AWAY, lastSeenAt: new Date() },
      update: { status: PresenceStatus.AWAY, lastSeenAt: new Date() },
    });
  }

  async ping(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastSeenAt: new Date() },
    });
    return this.setOnline(userId);
  }

  async getPresence(userIds: string[]) {
    const records = await this.prisma.userPresence.findMany({
      where: { userId: { in: userIds } },
    });
    const map = new Map(records.map((r) => [r.userId, r]));
    return userIds.map((id) => ({
      userId: id,
      status: map.get(id)?.status ?? PresenceStatus.OFFLINE,
      lastSeenAt: map.get(id)?.lastSeenAt ?? null,
    }));
  }

  async setTyping(conversationId: string, userId: string) {
    const expiresAt = new Date(Date.now() + 5000);
    return this.prisma.typingSession.upsert({
      where: { conversationId_userId: { conversationId, userId } },
      create: { conversationId, userId, expiresAt },
      update: { expiresAt },
    });
  }

  async clearTyping(conversationId: string, userId: string) {
    return this.prisma.typingSession.deleteMany({
      where: { conversationId, userId },
    });
  }

  async getTyping(conversationId: string) {
    return this.prisma.typingSession.findMany({
      where: { conversationId, expiresAt: { gt: new Date() } },
      select: { userId: true },
    });
  }

  async getStats(orgId?: string) {
    const orgFilter = orgId
      ? {
          user: {
            memberships: { some: { orgId, status: MembershipStatus.ACTIVE } },
          },
        }
      : {};

    const [online, away] = await Promise.all([
      this.prisma.userPresence.count({
        where: { status: PresenceStatus.ONLINE, ...orgFilter },
      }),
      this.prisma.userPresence.count({
        where: { status: PresenceStatus.AWAY, ...orgFilter },
      }),
    ]);

    return { online, away, total: online + away };
  }
}
