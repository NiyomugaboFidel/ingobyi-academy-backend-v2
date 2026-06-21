import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EnrollmentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ParentService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertChildAccess(parentId: string, childId: string) {
    const link = await this.prisma.parentChildLink.findUnique({
      where: { parentId_childId: { parentId, childId } },
    });
    if (!link) throw new ForbiddenException('Not linked to this child');
    return link;
  }

  async listChildren(parentId: string) {
    const links = await this.prisma.parentChildLink.findMany({
      where: { parentId },
      include: {
        child: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            email: true,
            memberships: {
              where: { status: 'ACTIVE' },
              select: {
                role: true,
                org: { select: { id: true, name: true, slug: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const children = await Promise.all(
      links.map(async (link) => {
        const child = link.child;
        const enrollments = await this.prisma.enrollment.findMany({
          where: {
            userId: child.id,
            status: {
              in: [EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED],
            },
          },
          include: {
            course: {
              select: {
                id: true,
                title: true,
                slug: true,
                thumbnailUrl: true,
                trainers: {
                  where: { isPrimary: true },
                  take: 1,
                  include: {
                    user: {
                      select: { id: true, firstName: true, lastName: true },
                    },
                  },
                },
                modules: {
                  select: {
                    lessons: { select: { id: true } },
                  },
                },
              },
            },
            progress: {
              where: { isCompleted: true },
              select: { lessonId: true, completedAt: true },
              orderBy: { completedAt: 'desc' },
            },
          },
        });

        const courses = enrollments.map((enrollment) => {
          const totalLessons = enrollment.course.modules.reduce(
            (sum, module) => sum + module.lessons.length,
            0,
          );
          const completedLessons = enrollment.progress.length;
          const progressPercent =
            totalLessons > 0
              ? Math.round((completedLessons / totalLessons) * 100)
              : 0;
          const primaryTrainer = enrollment.course.trainers[0]?.user;

          return {
            enrollmentId: enrollment.id,
            courseId: enrollment.course.id,
            title: enrollment.course.title,
            slug: enrollment.course.slug,
            thumbnailUrl: enrollment.course.thumbnailUrl,
            status: enrollment.status,
            progressPercent,
            completedLessons,
            totalLessons,
            enrolledAt: enrollment.enrolledAt,
            lastActivityAt:
              enrollment.progress[0]?.completedAt ?? enrollment.enrolledAt,
            trainer: primaryTrainer
              ? {
                  id: primaryTrainer.id,
                  name: `${primaryTrainer.firstName} ${primaryTrainer.lastName}`,
                }
              : null,
          };
        });

        const avgProgress = courses.length
          ? Math.round(
              courses.reduce((sum, c) => sum + c.progressPercent, 0) /
                courses.length,
            )
          : 0;

        const achievements = await this.prisma.studentAchievement.count({
          where: { userId: child.id },
        });

        const org = child.memberships[0]?.org ?? null;

        return {
          id: child.id,
          firstName: child.firstName,
          lastName: child.lastName,
          fullName: `${child.firstName} ${child.lastName}`,
          avatarUrl: child.avatarUrl,
          email: child.email,
          organization: org,
          courseCount: courses.length,
          avgProgress,
          achievements,
          lastActiveAt: courses.reduce<Date | null>((latest, course) => {
            const at = new Date(course.lastActivityAt);
            return !latest || at > latest ? at : latest;
          }, null),
          courses,
        };
      }),
    );

    return children;
  }

  async getChildDetail(parentId: string, childId: string) {
    await this.assertChildAccess(parentId, childId);
    const children = await this.listChildren(parentId);
    const child = children.find((c) => c.id === childId);
    if (!child) throw new NotFoundException('Child not found');

    const achievements = await this.prisma.studentAchievement.findMany({
      where: { userId: childId },
      include: { definition: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const upcomingAssignments = await this.prisma.assignment.findMany({
      where: {
        lesson: {
          module: {
            course: {
              enrollments: {
                some: { userId: childId, status: EnrollmentStatus.ACTIVE },
              },
            },
          },
        },
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        lesson: {
          select: {
            title: true,
            module: {
              select: { course: { select: { title: true, slug: true } } },
            },
          },
        },
      },
      orderBy: { dueDate: 'asc' },
      take: 5,
    });

    return { ...child, achievements, upcomingAssignments };
  }
}
