import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ConversationType,
  EnrollmentStatus,
  MembershipStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';

@Injectable()
export class MessagingPermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async assertCourseRoomAccess(
    userId: string,
    role: UserRole,
    courseId: string,
  ) {
    if (role === UserRole.SUPERADMIN) return;

    const [enrollment, trainer, adminMembership] = await Promise.all([
      this.prisma.enrollment.findUnique({
        where: { userId_courseId: { userId, courseId } },
      }),
      this.prisma.courseTrainer.findUnique({
        where: { courseId_userId: { courseId, userId } },
      }),
      this.prisma.course.findUnique({
        where: { id: courseId },
        select: {
          orgId: true,
          org: {
            select: {
              memberships: {
                where: {
                  userId,
                  status: MembershipStatus.ACTIVE,
                  role: UserRole.ADMIN,
                },
                take: 1,
              },
            },
          },
        },
      }),
    ]);

    const isEnrolled = enrollment?.status === EnrollmentStatus.ACTIVE;
    const isTrainer = !!trainer;
    const isOrgAdmin = (adminMembership?.org?.memberships?.length ?? 0) > 0;

    if (!isEnrolled && !isTrainer && !isOrgAdmin) {
      throw new ForbiddenException('You are not a member of this course room');
    }
  }

  async assertCanPostInCourseRoom(
    userId: string,
    role: UserRole,
    courseId: string,
    isAnnouncement = false,
  ) {
    await this.assertCourseRoomAccess(userId, role, courseId);

    if (isAnnouncement) {
      const trainer = await this.prisma.courseTrainer.findUnique({
        where: { courseId_userId: { courseId, userId } },
      });
      if (role === UserRole.SUPERADMIN || role === UserRole.ADMIN || trainer)
        return;
      throw new ForbiddenException(
        'Only trainers and admins can broadcast in course rooms',
      );
    }
  }

  async assertCanDeleteMessage(
    userId: string,
    role: UserRole,
    senderId: string,
    conversation: { type: ConversationType; courseId: string | null },
  ) {
    if (userId === senderId) return;
    if (role === UserRole.SUPERADMIN || role === UserRole.ADMIN) return;

    if (
      conversation.type === ConversationType.COURSE_ROOM &&
      conversation.courseId
    ) {
      const trainer = await this.prisma.courseTrainer.findUnique({
        where: { courseId_userId: { courseId: conversation.courseId, userId } },
      });
      if (trainer) return;
    }

    throw new ForbiddenException('You cannot delete this message');
  }

  async assertCanPin(userId: string, role: UserRole, courseId: string | null) {
    if (role === UserRole.SUPERADMIN || role === UserRole.ADMIN) return;
    if (!courseId)
      throw new ForbiddenException('Cannot pin in this conversation');
    const trainer = await this.prisma.courseTrainer.findUnique({
      where: { courseId_userId: { courseId, userId } },
    });
    if (!trainer)
      throw new ForbiddenException('Only trainers can pin messages');
  }

  /** Validate direct messaging between two users. */
  async assertDirectMessaging(
    senderId: string,
    senderRole: UserRole,
    receiverId: string,
  ) {
    if (senderId === receiverId) {
      throw new ForbiddenException('Cannot message yourself');
    }

    const receiver = await this.prisma.user.findUnique({
      where: { id: receiverId, isActive: true },
      select: { id: true, platformRole: true },
    });
    if (!receiver) throw new NotFoundException('User not found');

    if (senderRole === UserRole.SUPERADMIN) return;

    if (senderRole === UserRole.ADMIN) {
      await this.assertAdminCanMessage(senderId, receiverId);
      return;
    }

    if (senderRole === UserRole.TRAINER) {
      await this.assertTrainerCanMessage(senderId, receiverId);
      return;
    }

    if (senderRole === UserRole.STUDENT) {
      await this.assertStudentCanMessage(senderId, receiverId);
      return;
    }

    if (senderRole === UserRole.PARENT) {
      await this.assertParentCanMessage(senderId, receiverId);
      return;
    }

    throw new ForbiddenException('Messaging not allowed');
  }

  private async assertAdminCanMessage(adminId: string, targetId: string) {
    const adminOrgs = await this.prisma.membership.findMany({
      where: {
        userId: adminId,
        role: UserRole.ADMIN,
        status: MembershipStatus.ACTIVE,
      },
      select: { orgId: true },
    });
    const orgIds = adminOrgs.map((m) => m.orgId);
    if (!orgIds.length)
      throw new ForbiddenException('No organization admin access');

    const targetMembership = await this.prisma.membership.findFirst({
      where: {
        userId: targetId,
        orgId: { in: orgIds },
        status: MembershipStatus.ACTIVE,
      },
    });
    if (!targetMembership) {
      throw new ForbiddenException(
        'You can only message members of your organization',
      );
    }
  }

  private async assertTrainerCanMessage(trainerId: string, targetId: string) {
    const trainerCourses = await this.prisma.courseTrainer.findMany({
      where: { userId: trainerId },
      select: { courseId: true },
    });
    const courseIds = trainerCourses.map((t) => t.courseId);
    if (!courseIds.length) throw new ForbiddenException('No assigned courses');

    const [studentEnrollment, parentLink] = await Promise.all([
      this.prisma.enrollment.findFirst({
        where: {
          userId: targetId,
          courseId: { in: courseIds },
          status: EnrollmentStatus.ACTIVE,
        },
      }),
      this.prisma.parentChildLink.findFirst({
        where: {
          parentId: targetId,
          approvedAt: { not: null },
          child: {
            enrollments: {
              some: {
                courseId: { in: courseIds },
                status: EnrollmentStatus.ACTIVE,
              },
            },
          },
        },
      }),
    ]);

    if (!studentEnrollment && !parentLink) {
      throw new ForbiddenException(
        'You can only message enrolled students or their parents',
      );
    }
  }

  private async assertStudentCanMessage(studentId: string, targetId: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { userId: studentId, status: EnrollmentStatus.ACTIVE },
      select: { course: { select: { id: true, orgId: true } } },
    });
    const courseIds = enrollments.map((e) => e.course.id);
    const orgIds = [
      ...new Set(
        enrollments
          .map((e) => e.course.orgId)
          .filter((id): id is string => !!id),
      ),
    ];
    if (!courseIds.length)
      throw new ForbiddenException('Not enrolled in any courses');

    const [trainer, admin] = await Promise.all([
      this.prisma.courseTrainer.findFirst({
        where: { userId: targetId, courseId: { in: courseIds } },
      }),
      this.prisma.membership.findFirst({
        where: {
          userId: targetId,
          orgId: { in: orgIds },
          role: UserRole.ADMIN,
          status: MembershipStatus.ACTIVE,
        },
      }),
    ]);
    if (!trainer && !admin) {
      throw new ForbiddenException(
        'You can only message trainers and admins of your enrolled courses',
      );
    }
  }

  private async assertParentCanMessage(parentId: string, targetId: string) {
    const links = await this.prisma.parentChildLink.findMany({
      where: { parentId, approvedAt: { not: null } },
      select: { childId: true },
    });
    const childIds = links.map((l) => l.childId);
    if (!childIds.length) throw new ForbiddenException('No linked children');

    const childEnrollments = await this.prisma.enrollment.findMany({
      where: { userId: { in: childIds }, status: EnrollmentStatus.ACTIVE },
      select: { courseId: true },
    });
    const courseIds = childEnrollments.map((e) => e.courseId);
    if (!courseIds.length)
      throw new ForbiddenException('Children not enrolled in courses');

    const trainer = await this.prisma.courseTrainer.findFirst({
      where: { userId: targetId, courseId: { in: courseIds } },
    });
    if (!trainer) {
      throw new ForbiddenException(
        'You can only message trainers teaching your children',
      );
    }
  }

  async getMessageableContacts(user: AuthenticatedUser) {
    const { userId, role } = user;

    if (role === UserRole.SUPERADMIN) {
      const admins = await this.prisma.user.findMany({
        where: { platformRole: UserRole.ADMIN, isActive: true },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          platformRole: true,
          lastSeenAt: true,
        },
        take: 100,
      });
      return admins;
    }

    if (role === UserRole.ADMIN) {
      const orgs = await this.prisma.membership.findMany({
        where: {
          userId,
          role: UserRole.ADMIN,
          status: MembershipStatus.ACTIVE,
        },
        select: { orgId: true },
      });
      const orgIds = orgs.map((o) => o.orgId);
      return this.prisma.user.findMany({
        where: {
          isActive: true,
          id: { not: userId },
          memberships: {
            some: { orgId: { in: orgIds }, status: MembershipStatus.ACTIVE },
          },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          platformRole: true,
          lastSeenAt: true,
        },
        take: 200,
      });
    }

    if (role === UserRole.TRAINER) {
      const courseIds = (
        await this.prisma.courseTrainer.findMany({
          where: { userId },
          select: { courseId: true },
        })
      ).map((c) => c.courseId);

      const [students, parents] = await Promise.all([
        this.prisma.user.findMany({
          where: {
            isActive: true,
            enrollments: {
              some: {
                courseId: { in: courseIds },
                status: EnrollmentStatus.ACTIVE,
              },
            },
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            platformRole: true,
            lastSeenAt: true,
          },
        }),
        this.prisma.user.findMany({
          where: {
            isActive: true,
            platformRole: UserRole.PARENT,
            parentLinks: {
              some: {
                approvedAt: { not: null },
                child: {
                  enrollments: {
                    some: {
                      courseId: { in: courseIds },
                      status: EnrollmentStatus.ACTIVE,
                    },
                  },
                },
              },
            },
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            platformRole: true,
            lastSeenAt: true,
          },
        }),
      ]);

      const map = new Map<string, (typeof students)[0]>();
      [...students, ...parents].forEach((u) => map.set(u.id, u));
      return Array.from(map.values());
    }

    if (role === UserRole.STUDENT) {
      const enrollments = await this.prisma.enrollment.findMany({
        where: { userId, status: EnrollmentStatus.ACTIVE },
        select: { course: { select: { id: true, title: true, orgId: true } } },
      });
      const courseIds = enrollments.map((e) => e.course.id);
      const orgIds = [
        ...new Set(
          enrollments
            .map((e) => e.course.orgId)
            .filter((id): id is string => !!id),
        ),
      ];

      const trainers = await this.prisma.courseTrainer.findMany({
        where: { courseId: { in: courseIds } },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
              platformRole: true,
              lastSeenAt: true,
            },
          },
          course: { select: { id: true, title: true } },
        },
      });

      const adminMemberships = orgIds.length
        ? await this.prisma.membership.findMany({
            where: {
              orgId: { in: orgIds },
              role: UserRole.ADMIN,
              status: MembershipStatus.ACTIVE,
              userId: { not: userId },
            },
            select: { userId: true, orgId: true },
          })
        : [];

      const [adminUsers, orgs] = await Promise.all([
        adminMemberships.length
          ? this.prisma.user.findMany({
              where: {
                id: { in: adminMemberships.map((m) => m.userId) },
                isActive: true,
              },
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
                platformRole: true,
                lastSeenAt: true,
              },
            })
          : Promise.resolve([]),
        orgIds.length
          ? this.prisma.organization.findMany({
              where: { id: { in: orgIds } },
              select: { id: true, name: true },
            })
          : Promise.resolve([]),
      ]);

      const orgNameById = new Map(orgs.map((o) => [o.id, o.name]));
      const admins = adminMemberships
        .map((m) => ({
          userId: m.userId,
          user: adminUsers.find((u) => u.id === m.userId)!,
          orgName: orgNameById.get(m.orgId) ?? 'Organization',
        }))
        .filter((a) => a.user);

      type Contact = {
        id: string;
        firstName: string;
        lastName: string;
        avatarUrl: string | null;
        platformRole: UserRole;
        lastSeenAt: Date | null;
        contactLabel?: string;
      };

      const map = new Map<string, Contact>();
      for (const t of trainers) {
        const existing = map.get(t.userId);
        const label = `Trainer · ${t.course.title}`;
        if (existing) {
          existing.contactLabel = `${existing.contactLabel}; ${t.course.title}`;
        } else {
          map.set(t.userId, { ...t.user, contactLabel: label });
        }
      }
      for (const a of admins) {
        if (!map.has(a.userId)) {
          map.set(a.userId, {
            ...a.user,
            contactLabel: `Admin · ${a.orgName}`,
          });
        }
      }
      return Array.from(map.values());
    }

    if (role === UserRole.PARENT) {
      const childIds = (
        await this.prisma.parentChildLink.findMany({
          where: { parentId: userId, approvedAt: { not: null } },
          select: { childId: true },
        })
      ).map((l) => l.childId);

      const courseIds = (
        await this.prisma.enrollment.findMany({
          where: { userId: { in: childIds }, status: EnrollmentStatus.ACTIVE },
          select: { courseId: true },
        })
      ).map((e) => e.courseId);

      const trainerIds = (
        await this.prisma.courseTrainer.findMany({
          where: { courseId: { in: courseIds } },
          select: { userId: true },
        })
      ).map((t) => t.userId);

      return this.prisma.user.findMany({
        where: { id: { in: trainerIds }, isActive: true },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          platformRole: true,
          lastSeenAt: true,
        },
      });
    }

    return [];
  }
}
