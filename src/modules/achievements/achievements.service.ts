import { Injectable } from '@nestjs/common';
import { AchievementTrigger, EnrollmentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AwardCustomAchievementDto } from './dto/award-custom-achievement.dto';
import { CreateAchievementDto } from './dto/create-achievement.dto';

export type UnifiedAchievementKind =
  | 'certificate'
  | 'badge'
  | 'course'
  | 'custom';

export type UnifiedAchievement = {
  id: string;
  kind: UnifiedAchievementKind;
  title: string;
  description: string;
  earnedAt: string;
  points: number;
  iconUrl?: string | null;
  courseTitle?: string;
  courseSlug?: string;
  certificateId?: string;
  verifyCode?: string;
  pdfUrl?: string | null;
  definitionId?: string;
};

@Injectable()
export class AchievementsService {
  constructor(private readonly prisma: PrismaService) {}

  listDefinitions() {
    return this.prisma.achievementDefinition.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  createDefinition(dto: CreateAchievementDto) {
    return this.prisma.achievementDefinition.create({ data: dto });
  }

  updateDefinition(id: string, dto: Partial<CreateAchievementDto>) {
    return this.prisma.achievementDefinition.update({
      where: { id },
      data: dto,
    });
  }

  mine(userId: string) {
    return this.getUnifiedForUser(userId);
  }

  async getUnifiedForUser(userId: string): Promise<UnifiedAchievement[]> {
    const [badges, certificates, completedEnrollments] = await Promise.all([
      this.prisma.studentAchievement.findMany({
        where: { userId },
        include: { definition: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.certificate.findMany({
        where: { userId, revokedAt: null },
        include: {
          course: { select: { id: true, title: true, slug: true } },
        },
        orderBy: { issuedAt: 'desc' },
      }),
      this.prisma.enrollment.findMany({
        where: { userId, status: EnrollmentStatus.COMPLETED },
        include: {
          course: { select: { id: true, title: true, slug: true } },
        },
        orderBy: { completedAt: 'desc' },
      }),
    ]);

    const certCourseIds = new Set(certificates.map((c) => c.courseId));
    const items: UnifiedAchievement[] = [];

    for (const cert of certificates) {
      items.push({
        id: `certificate-${cert.id}`,
        kind: 'certificate',
        title: cert.course.title,
        description: `Certificate of completion issued by Ingobyi Innovation Hub for ${cert.course.title}`,
        earnedAt: cert.issuedAt.toISOString(),
        points: 50,
        courseTitle: cert.course.title,
        courseSlug: cert.course.slug,
        certificateId: cert.id,
        verifyCode: cert.verifyCode,
        pdfUrl: cert.pdfUrl,
      });
    }

    for (const enrollment of completedEnrollments) {
      if (certCourseIds.has(enrollment.courseId)) continue;
      items.push({
        id: `course-${enrollment.id}`,
        kind: 'course',
        title: enrollment.course.title,
        description: `Completed the course ${enrollment.course.title}`,
        earnedAt: (
          enrollment.completedAt ?? enrollment.enrolledAt
        ).toISOString(),
        points: 25,
        courseTitle: enrollment.course.title,
        courseSlug: enrollment.course.slug,
      });
    }

    for (const badge of badges) {
      const kind: UnifiedAchievementKind =
        badge.definition.trigger === AchievementTrigger.MANUALLY_AWARDED
          ? 'custom'
          : 'badge';
      items.push({
        id: badge.id,
        kind,
        title: badge.definition.title,
        description: badge.definition.description,
        earnedAt: (badge.approvedAt ?? badge.createdAt).toISOString(),
        points: badge.definition.points,
        iconUrl: badge.definition.iconUrl,
        definitionId: badge.definitionId,
      });
    }

    return items.sort(
      (a, b) => new Date(b.earnedAt).getTime() - new Date(a.earnedAt).getTime(),
    );
  }

  totalPoints(userId: string): Promise<number> {
    return this.getUnifiedForUser(userId).then((items) =>
      items.reduce((sum, item) => sum + item.points, 0),
    );
  }

  award(userId: string, definitionId: string, awardedBy: string) {
    return this.prisma.studentAchievement.upsert({
      where: { userId_definitionId: { userId, definitionId } },
      create: { userId, definitionId, awardedBy, approvedAt: new Date() },
      update: { awardedBy, approvedAt: new Date() },
      include: { definition: true },
    });
  }

  async awardCustom(dto: AwardCustomAchievementDto, awardedBy: string) {
    const definition = await this.prisma.achievementDefinition.create({
      data: {
        title: dto.title.trim(),
        description: dto.description.trim(),
        trigger: AchievementTrigger.MANUALLY_AWARDED,
        points: dto.points ?? 15,
        iconUrl: dto.iconUrl,
        isAutomatic: false,
        isActive: true,
      },
    });

    await this.award(dto.userId, definition.id, awardedBy);
    return this.getUnifiedForUser(dto.userId);
  }
}
