import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EnrollmentStatus, MembershipStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ParentService {
  constructor(private readonly prisma: PrismaService) {}

  async linkChildren(parentId: string, childIds: string[], orgId: string) {
    const uniqueChildIds = await this.validateChildrenInOrg(childIds, orgId);
    if (uniqueChildIds.includes(parentId)) {
      throw new BadRequestException('A parent cannot be linked to themselves');
    }

    const approvedAt = new Date();
    await this.prisma.$transaction(
      uniqueChildIds.map((childId) =>
        this.prisma.parentChildLink.upsert({
          where: { parentId_childId: { parentId, childId } },
          create: { parentId, childId, approvedAt },
          update: { approvedAt },
        }),
      ),
    );

    return { linked: uniqueChildIds.length };
  }

  async validateChildrenInOrg(childIds: string[], orgId: string) {
    if (!childIds?.length) {
      throw new BadRequestException(
        'Select at least one student to link to this parent',
      );
    }

    const uniqueChildIds = [...new Set(childIds)];
    const students = await this.prisma.user.findMany({
      where: {
        id: { in: uniqueChildIds },
        isActive: true,
        memberships: {
          some: {
            orgId,
            role: UserRole.STUDENT,
            status: MembershipStatus.ACTIVE,
          },
        },
      },
      select: { id: true },
    });

    if (students.length !== uniqueChildIds.length) {
      throw new BadRequestException(
        'One or more selected students are invalid or not active students in this organization',
      );
    }

    return uniqueChildIds;
  }

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

        const courseIds = enrollments.map((e) => e.course.id);

        const [sessionCounts, attendanceRows, certificates] = await Promise.all([
          courseIds.length
            ? this.prisma.physicalSession.groupBy({
                by: ['courseId'],
                where: { courseId: { in: courseIds } },
                _count: { _all: true },
              })
            : Promise.resolve([]),
          courseIds.length
            ? this.prisma.physicalAttendance.findMany({
                where: {
                  userId: child.id,
                  session: { courseId: { in: courseIds } },
                },
                select: {
                  status: true,
                  session: { select: { courseId: true } },
                },
              })
            : Promise.resolve([]),
          this.prisma.certificate.findMany({
            where: { userId: child.id, revokedAt: null },
            select: {
              id: true,
              issuedAt: true,
              verifyCode: true,
              pdfUrl: true,
              course: { select: { id: true, title: true, slug: true } },
            },
            orderBy: { issuedAt: 'desc' },
          }),
        ]);

        const sessionsByCourse = new Map(
          sessionCounts.map((row) => [row.courseId, row._count._all]),
        );
        const presentByCourse = new Map<string, number>();
        for (const row of attendanceRows) {
          if (row.status !== 'PRESENT' && row.status !== 'LATE') continue;
          const cid = row.session.courseId;
          presentByCourse.set(cid, (presentByCourse.get(cid) ?? 0) + 1);
        }

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
          const totalSessions = sessionsByCourse.get(enrollment.course.id) ?? 0;
          const attendedSessions = presentByCourse.get(enrollment.course.id) ?? 0;
          const attendancePercent =
            totalSessions > 0
              ? Math.round((attendedSessions / totalSessions) * 100)
              : null;

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
            totalSessions,
            attendedSessions,
            attendancePercent,
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

        const coursesWithAttendance = courses.filter(
          (c) => c.attendancePercent != null,
        );
        const avgAttendance = coursesWithAttendance.length
          ? Math.round(
              coursesWithAttendance.reduce(
                (sum, c) => sum + (c.attendancePercent ?? 0),
                0,
              ) / coursesWithAttendance.length,
            )
          : null;

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
          avgAttendance,
          achievements,
          certificateCount: certificates.length,
          certificates: certificates.map((cert) => ({
            id: cert.id,
            issuedAt: cert.issuedAt,
            verifyCode: cert.verifyCode,
            pdfUrl: cert.pdfUrl,
            course: cert.course,
          })),
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
      take: 20,
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

    return {
      ...child,
      achievementList: achievements.map((a) => ({
        id: a.id,
        earnedAt: a.createdAt,
        definition: {
          name: a.definition.title,
          description: a.definition.description,
        },
      })),
      upcomingAssignments,
    };
  }
}
