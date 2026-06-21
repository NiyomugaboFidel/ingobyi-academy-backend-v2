import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveWorkspace } from '../../common/utils/resolve-effective-role';
import { sanitizeUser } from '../../common/utils/sanitize-user';
import { AchievementsService } from '../achievements/achievements.service';
import { UpdateAvatarDto } from './dto/update-avatar.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly achievements: AchievementsService,
  ) {}

  async getMe(
    userId: string,
    jwtContext?: { orgId?: string; orgRole?: string },
  ) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId, isActive: true },
      include: {
        memberships: {
          where: { status: 'ACTIVE' },
          select: {
            role: true,
            orgId: true,
            joinedAt: true,
            status: true,
            org: {
              select: {
                id: true,
                name: true,
                slug: true,
                logoUrl: true,
                isActive: true,
              },
            },
          },
        },
      },
    });
    const workspace = resolveWorkspace(
      user.platformRole,
      user.memberships,
      jwtContext?.orgId,
    );
    const sanitized = sanitizeUser(user);
    return {
      ...sanitized,
      activeOrgId: jwtContext?.orgId ?? workspace.orgId ?? null,
      activeOrgRole: jwtContext?.orgRole ?? workspace.orgRole ?? null,
    };
  }

  async updateMe(userId: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: dto,
    });
    return sanitizeUser(user);
  }

  async deleteMe(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });
    return { message: 'Account deactivated' };
  }

  async getPublicProfile(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        bio: true,
        country: true,
        createdAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  getAchievements(userId: string) {
    return this.achievements.getUnifiedForUser(userId);
  }

  async getCourses(userId: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { userId, status: { in: ['ACTIVE', 'COMPLETED'] } },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            slug: true,
            thumbnailUrl: true,
            status: true,
          },
        },
      },
    });
    return enrollments.map((e) => ({
      ...e.course,
      enrollmentStatus: e.status,
      enrolledAt: e.enrolledAt,
      completedAt: e.completedAt,
    }));
  }

  async updateAvatar(userId: string, dto: UpdateAvatarDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: dto.avatarUrl },
    });
    return sanitizeUser(user);
  }
}
