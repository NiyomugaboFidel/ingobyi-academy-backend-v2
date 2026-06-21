import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditAction, CourseStatus, EnrollmentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../../shared/email/email.service';

@Injectable()
export class EnrollmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly email: EmailService,
  ) {}

  async enroll(
    userId: string,
    courseId: string,
    source = 'DIRECT',
    apiKeyId?: string,
  ) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });
    if (!course || course.status !== CourseStatus.PUBLISHED) {
      throw new BadRequestException('Course not available for enrollment');
    }

    const existing = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
      include: { course: { select: { id: true, title: true, slug: true } } },
    });

    if (existing) {
      if (
        existing.status === EnrollmentStatus.ACTIVE ||
        existing.status === EnrollmentStatus.COMPLETED
      ) {
        return existing;
      }

      if (
        existing.status === EnrollmentStatus.DROPPED ||
        existing.status === EnrollmentStatus.EXPIRED
      ) {
        const reactivated = await this.prisma.enrollment.update({
          where: { id: existing.id },
          data: { status: EnrollmentStatus.ACTIVE, source, apiKeyId },
          include: {
            course: { select: { id: true, title: true, slug: true } },
          },
        });
        await this.audit.log({
          userId,
          orgId: course.orgId ?? undefined,
          action: AuditAction.ENROLL,
          entity: 'Enrollment',
          entityId: reactivated.id,
        });
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { email: true },
        });
        if (user) {
          void this.email.sendEnrollment(
            user.email,
            reactivated.course.title,
            courseId,
          );
        }
        return reactivated;
      }

      return existing;
    }

    const enrollment = await this.prisma.enrollment.create({
      data: { userId, courseId, source, apiKeyId },
      include: { course: { select: { id: true, title: true, slug: true } } },
    });
    await this.audit.log({
      userId,
      orgId: course.orgId ?? undefined,
      action: AuditAction.ENROLL,
      entity: 'Enrollment',
      entityId: enrollment.id,
    });
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (user) {
      void this.email.sendEnrollment(
        user.email,
        enrollment.course.title,
        courseId,
      );
    }
    return enrollment;
  }

  async unenroll(userId: string, courseId: string) {
    const enrollment = await this.prisma.enrollment.update({
      where: { userId_courseId: { userId, courseId } },
      data: { status: EnrollmentStatus.DROPPED },
    });
    await this.audit.log({
      userId,
      action: AuditAction.UNENROLL,
      entity: 'Enrollment',
      entityId: enrollment.id,
    });
    return { message: 'Unenrolled' };
  }

  async myEnrollments(userId: string) {
    return this.prisma.enrollment.findMany({
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
      orderBy: { enrolledAt: 'desc' },
    });
  }

  async check(userId: string, courseId: string) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    const isEnrolled =
      !!enrollment &&
      (enrollment.status === EnrollmentStatus.ACTIVE ||
        enrollment.status === EnrollmentStatus.COMPLETED);
    return {
      enrolled: isEnrolled,
      status: enrollment?.status ?? null,
      enrollmentId: enrollment?.id,
      completedAt: enrollment?.completedAt,
    };
  }
}
