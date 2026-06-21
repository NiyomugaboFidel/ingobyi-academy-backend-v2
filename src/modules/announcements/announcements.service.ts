import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  AnnouncementScope,
  AnnouncementTargetType,
  MembershipStatus,
  NotificationType,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';
import type { AppGateway } from '../gateway/app.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';

@Injectable()
export class AnnouncementsService implements OnModuleInit {
  private gateway!: AppGateway;

  constructor(
    private readonly prisma: PrismaService,
    private readonly moduleRef: ModuleRef,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit(): void {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { AppGateway: Gateway } = require('../gateway/app.gateway') as {
      AppGateway: new (...args: never[]) => AppGateway;
    };
    this.gateway = this.moduleRef.get(Gateway, { strict: false });
  }

  async mine(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { platformRole: true },
    });
    const memberships = await this.prisma.membership.findMany({
      where: { userId, status: MembershipStatus.ACTIVE },
      select: { orgId: true, role: true },
    });
    const orgIds = memberships.map((m) => m.orgId);
    const enrollments = await this.prisma.enrollment.findMany({
      where: { userId, status: 'ACTIVE' },
      select: { courseId: true },
    });
    const courseIds = enrollments.map((e) => e.courseId);
    const cohortMembers = await this.prisma.cohortMember.findMany({
      where: { userId },
      select: { cohortId: true },
    });
    const cohortIds = cohortMembers.map((c) => c.cohortId);

    const announcements = await this.prisma.announcement.findMany({
      where: {
        AND: [
          {
            OR: [
              { scope: AnnouncementScope.PLATFORM },
              { orgId: { in: orgIds } },
              { courseId: { in: courseIds } },
              { cohortId: { in: cohortIds } },
              { targetRole: user?.platformRole },
            ],
          },
          { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
          { publishedAt: { not: null } },
        ],
      },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        targets: true,
        reads: { where: { userId } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return announcements.map((a) => ({
      ...a,
      isRead: a.reads.length > 0,
    }));
  }

  async create(author: AuthenticatedUser, dto: CreateAnnouncementDto) {
    const announcement = await this.prisma.announcement.create({
      data: {
        title: dto.title,
        content: dto.content,
        scope: dto.scope ?? AnnouncementScope.ORG,
        orgId: dto.orgId ?? author.orgId,
        cohortId: dto.cohortId,
        courseId: dto.courseId,
        targetRole: dto.targetRole,
        authorId: author.userId,
        publishedAt: new Date(),
        expiresAt: dto.expiresAt,
        targets: dto.targets?.length ? { create: dto.targets } : undefined,
      },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        targets: true,
      },
    });

    const recipientIds = await this.resolveRecipients(announcement);
    for (const userId of recipientIds) {
      await this.notifications.create(
        userId,
        NotificationType.ANNOUNCEMENT,
        announcement.title,
        announcement.content.slice(0, 120),
        '/announcements',
      );
    }

    this.gateway?.emitAnnouncement(recipientIds, announcement);
    return announcement;
  }

  private async resolveRecipients(announcement: {
    scope: AnnouncementScope;
    orgId: string | null;
    courseId: string | null;
    cohortId: string | null;
    targetRole: UserRole | null;
    targets: Array<{
      targetType: AnnouncementTargetType;
      targetValue: string | null;
    }>;
  }): Promise<string[]> {
    const ids = new Set<string>();

    if (announcement.targets.length) {
      for (const t of announcement.targets) {
        switch (t.targetType) {
          case AnnouncementTargetType.ALL_USERS: {
            const users = await this.prisma.user.findMany({
              where: { isActive: true },
              select: { id: true },
            });
            users.forEach((u) => ids.add(u.id));
            break;
          }
          case AnnouncementTargetType.ORG: {
            if (t.targetValue) {
              const members = await this.prisma.membership.findMany({
                where: {
                  orgId: t.targetValue,
                  status: MembershipStatus.ACTIVE,
                },
                select: { userId: true },
              });
              members.forEach((m) => ids.add(m.userId));
            }
            break;
          }
          case AnnouncementTargetType.ROLE: {
            if (t.targetValue) {
              const users = await this.prisma.user.findMany({
                where: {
                  platformRole: t.targetValue as UserRole,
                  isActive: true,
                },
                select: { id: true },
              });
              users.forEach((u) => ids.add(u.id));
            }
            break;
          }
          case AnnouncementTargetType.COURSE: {
            if (t.targetValue) {
              const enrollments = await this.prisma.enrollment.findMany({
                where: { courseId: t.targetValue, status: 'ACTIVE' },
                select: { userId: true },
              });
              enrollments.forEach((e) => ids.add(e.userId));
            }
            break;
          }
          case AnnouncementTargetType.COHORT: {
            if (t.targetValue) {
              const members = await this.prisma.cohortMember.findMany({
                where: { cohortId: t.targetValue },
                select: { userId: true },
              });
              members.forEach((m) => ids.add(m.userId));
            }
            break;
          }
        }
      }
      return Array.from(ids);
    }

    if (announcement.scope === AnnouncementScope.PLATFORM) {
      const users = await this.prisma.user.findMany({
        where: { isActive: true },
        select: { id: true },
      });
      return users.map((u) => u.id);
    }

    if (announcement.courseId) {
      const enrollments = await this.prisma.enrollment.findMany({
        where: { courseId: announcement.courseId, status: 'ACTIVE' },
        select: { userId: true },
      });
      enrollments.forEach((e) => ids.add(e.userId));
      const trainers = await this.prisma.courseTrainer.findMany({
        where: { courseId: announcement.courseId },
        select: { userId: true },
      });
      trainers.forEach((t) => ids.add(t.userId));
      return Array.from(ids);
    }

    if (announcement.cohortId) {
      const members = await this.prisma.cohortMember.findMany({
        where: { cohortId: announcement.cohortId },
        select: { userId: true },
      });
      return members.map((m) => m.userId);
    }

    if (announcement.orgId) {
      const where: {
        orgId: string;
        status: typeof MembershipStatus.ACTIVE;
        role?: UserRole;
      } = {
        orgId: announcement.orgId,
        status: MembershipStatus.ACTIVE,
      };
      if (announcement.targetRole) where.role = announcement.targetRole;
      const members = await this.prisma.membership.findMany({
        where,
        select: { userId: true },
      });
      return members.map((m) => m.userId);
    }

    return [];
  }

  async markRead(announcementId: string, userId: string) {
    return this.prisma.announcementRead.upsert({
      where: { announcementId_userId: { announcementId, userId } },
      create: { announcementId, userId },
      update: { readAt: new Date() },
    });
  }

  async unreadCount(userId: string) {
    const all = await this.mine(userId);
    return all.filter((a) => !a.isRead).length;
  }

  update(id: string, dto: Partial<CreateAnnouncementDto>) {
    // targets are managed separately; strip from scalar update payload
    const { targets, ...data } = dto;
    void targets;
    return this.prisma.announcement.update({ where: { id }, data });
  }

  remove(id: string) {
    return this.prisma.announcement.delete({ where: { id } });
  }
}
