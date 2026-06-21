import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CourseStatus, EnrollmentStatus, Prisma } from '@prisma/client';
import { buildPaginatedMeta } from '../../common/dto/pagination.dto';
import { ApiKeyContext } from '../../common/interfaces/request-with-user.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { AchievementsService } from '../achievements/achievements.service';
import { CatalogService } from '../catalog/catalog.service';
import { CertificatesService } from '../certificates/certificates.service';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import {
  PartnerCoursesQueryDto,
  PartnerEnrollmentsQueryDto,
} from './dto/partner-query.dto';

const PARTNER_API_INDEX = {
  version: '1.0',
  authentication: {
    header: 'X-API-Key',
    description: 'Pass your API key in the X-API-Key request header.',
  },
  scopes: {
    COURSE_READ: 'Read published courses, categories, and curriculum metadata',
    ENROLLMENT_READ: 'Read enrollment status and lists',
    ENROLLMENT_WRITE: 'Enroll learners in published courses',
    CERTIFICATE_VERIFY: 'Verify and list certificates',
    LEARNER_READ: 'Read learner progress, achievements, and learning records',
  },
  endpoints: [
    { method: 'GET', path: '/api/partner', scope: 'any active key' },
    { method: 'GET', path: '/api/partner/organization', scope: 'COURSE_READ' },
    { method: 'GET', path: '/api/partner/courses', scope: 'COURSE_READ' },
    {
      method: 'GET',
      path: '/api/partner/courses/by-slug/:slug',
      scope: 'COURSE_READ',
    },
    { method: 'GET', path: '/api/partner/courses/:id', scope: 'COURSE_READ' },
    { method: 'GET', path: '/api/partner/categories', scope: 'COURSE_READ' },
    {
      method: 'GET',
      path: '/api/partner/enrollments',
      scope: 'ENROLLMENT_READ',
    },
    {
      method: 'GET',
      path: '/api/partner/enrollments/check',
      scope: 'ENROLLMENT_READ',
    },
    {
      method: 'POST',
      path: '/api/partner/enrollments',
      scope: 'ENROLLMENT_WRITE',
    },
    {
      method: 'GET',
      path: '/api/partner/learners/:id/learning',
      scope: 'LEARNER_READ',
    },
    {
      method: 'GET',
      path: '/api/partner/learners/:id/enrollments',
      scope: 'LEARNER_READ',
    },
    {
      method: 'GET',
      path: '/api/partner/learners/:id/progress/:courseId',
      scope: 'LEARNER_READ',
    },
    {
      method: 'GET',
      path: '/api/partner/learners/:id/certificates',
      scope: 'LEARNER_READ',
    },
    {
      method: 'GET',
      path: '/api/partner/learners/:id/achievements',
      scope: 'LEARNER_READ',
    },
    {
      method: 'GET',
      path: '/api/partner/certificates/verify/:code',
      scope: 'CERTIFICATE_VERIFY',
    },
  ],
} as const;

@Injectable()
export class PartnerApiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
    private readonly enrollments: EnrollmentsService,
    private readonly certificates: CertificatesService,
    private readonly achievements: AchievementsService,
  ) {}

  getIndex() {
    return PARTNER_API_INDEX;
  }

  async getOrganization(apiKey: ApiKeyContext) {
    if (!apiKey.orgId) {
      return { scoped: false, organization: null };
    }
    const organization = await this.prisma.organization.findUnique({
      where: { id: apiKey.orgId },
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        country: true,
        city: true,
        logoUrl: true,
        isVerified: true,
      },
    });
    return { scoped: true, organization };
  }

  async listCourses(apiKey: ApiKeyContext, query: PartnerCoursesQueryDto) {
    const orgFilter = this.courseOrgWhere(apiKey);

    const where: Prisma.CourseWhereInput = {
      status: CourseStatus.PUBLISHED,
      ...orgFilter,
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: 'insensitive' } },
              { shortDescription: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.level ? { level: query.level } : {}),
      ...(query.category ? { category: { slug: query.category } } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.course.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { publishedAt: 'desc' },
        select: {
          id: true,
          title: true,
          slug: true,
          shortDescription: true,
          thumbnailUrl: true,
          type: true,
          level: true,
          language: true,
          price: true,
          tags: true,
          publishedAt: true,
          org: { select: { id: true, name: true, slug: true } },
          category: { select: { id: true, name: true, slug: true } },
          _count: { select: { enrollments: true, reviews: true } },
        },
      }),
      this.prisma.course.count({ where }),
    ]);

    const stats = await this.loadCourseStats(rows.map((r) => r.id));

    const data = rows.map((row) => {
      const extra = stats.get(row.id);
      return {
        ...row,
        price: row.price != null ? row.price.toString() : null,
        avgRating: extra?.avgRating ?? null,
        reviewCount: extra?.reviewCount ?? row._count.reviews,
        totalDurationMinutes: extra?.totalDurationMinutes ?? 0,
        lessonCount: extra?.lessonCount ?? 0,
        enrollmentCount: row._count.enrollments,
      };
    });

    return {
      data,
      meta: buildPaginatedMeta(query.page, query.limit, total),
    };
  }

  listCategories() {
    return this.catalog.listCategories();
  }

  async getCourseById(apiKey: ApiKeyContext, id: string) {
    const course = await this.prisma.course.findFirst({
      where: {
        id,
        status: CourseStatus.PUBLISHED,
        ...this.courseOrgWhere(apiKey),
      },
      include: {
        org: { select: { id: true, name: true, slug: true, logoUrl: true } },
        category: { select: { id: true, name: true, slug: true } },
        trainers: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
              },
            },
          },
        },
        modules: {
          where: { isPublished: true },
          orderBy: { order: 'asc' },
          include: {
            lessons: {
              where: { isPublished: true },
              orderBy: { order: 'asc' },
              select: {
                id: true,
                title: true,
                type: true,
                duration: true,
                order: true,
                isFree: true,
              },
            },
          },
        },
        reviews: {
          where: { isVisible: true },
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            rating: true,
            comment: true,
            createdAt: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });
    if (!course) throw new NotFoundException('Course not found');

    const stats = await this.loadCourseStats([course.id]);
    const extra = stats.get(course.id);

    return {
      ...course,
      price: course.price != null ? course.price.toString() : null,
      avgRating: extra?.avgRating ?? null,
      reviewCount: extra?.reviewCount ?? course.reviews.length,
      totalDurationMinutes: extra?.totalDurationMinutes ?? 0,
      lessonCount: extra?.lessonCount ?? 0,
    };
  }

  async getCourseBySlug(apiKey: ApiKeyContext, slug: string) {
    const course = await this.prisma.course.findFirst({
      where: {
        slug,
        status: CourseStatus.PUBLISHED,
        ...this.courseOrgWhere(apiKey),
      },
      select: { id: true },
    });
    if (!course) throw new NotFoundException('Course not found');
    return this.getCourseById(apiKey, course.id);
  }

  async listEnrollments(
    apiKey: ApiKeyContext,
    query: PartnerEnrollmentsQueryDto,
  ) {
    const where: Prisma.EnrollmentWhereInput = {
      ...(query.learnerId ? { userId: query.learnerId } : {}),
      ...(query.courseId ? { courseId: query.courseId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(apiKey.orgId ? { course: { orgId: apiKey.orgId } } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.enrollment.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { enrolledAt: 'desc' },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          course: {
            select: {
              id: true,
              title: true,
              slug: true,
              org: { select: { id: true, name: true } },
            },
          },
          progress: { select: { lessonId: true, isCompleted: true } },
        },
      }),
      this.prisma.enrollment.count({ where }),
    ]);

    const data = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        progressSummary: await this.buildProgressSummary(row),
      })),
    );

    return {
      data,
      meta: buildPaginatedMeta(query.page, query.limit, total),
    };
  }

  enrollLearner(apiKey: ApiKeyContext, userId: string, courseId: string) {
    return this.enrollments.enroll(
      userId,
      courseId,
      'PARTNER_API',
      apiKey.apiKeyId,
    );
  }

  checkEnrollment(userId: string, courseId: string) {
    return this.enrollments.check(userId, courseId);
  }

  verifyCertificate(code: string) {
    return this.certificates.verify(code);
  }

  async getLearnerLearningRecord(apiKey: ApiKeyContext, userId: string) {
    await this.assertLearnerInScope(apiKey, userId);

    const [enrollments, certificates, allAchievements, user] =
      await Promise.all([
        this.getLearnerEnrollments(apiKey, userId),
        this.getLearnerCertificates(apiKey, userId),
        this.achievements.getUnifiedForUser(userId),
        this.prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
            country: true,
            createdAt: true,
          },
        }),
      ]);

    const achievementList = await this.filterAchievementsForOrg(
      apiKey,
      allAchievements,
    );

    return {
      learner: user,
      enrollments,
      certificates,
      achievements: achievementList,
      summary: {
        coursesEnrolled: enrollments.length,
        coursesCompleted: enrollments.filter(
          (e) => e.status === EnrollmentStatus.COMPLETED,
        ).length,
        certificatesEarned: certificates.length,
        achievementPoints: achievementList.reduce((s, a) => s + a.points, 0),
      },
    };
  }

  async getLearnerEnrollments(apiKey: ApiKeyContext, userId: string) {
    await this.assertLearnerInScope(apiKey, userId);

    const rows = await this.prisma.enrollment.findMany({
      where: {
        userId,
        ...(apiKey.orgId ? { course: { orgId: apiKey.orgId } } : {}),
      },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            slug: true,
            thumbnailUrl: true,
            level: true,
            org: { select: { id: true, name: true } },
          },
        },
        progress: {
          select: { lessonId: true, isCompleted: true, completedAt: true },
        },
      },
      orderBy: { enrolledAt: 'desc' },
    });

    return Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        status: row.status,
        enrolledAt: row.enrolledAt,
        completedAt: row.completedAt,
        source: row.source,
        course: row.course,
        progress: await this.buildProgressSummary(row),
      })),
    );
  }

  async getLearnerCourseProgress(
    apiKey: ApiKeyContext,
    userId: string,
    courseId: string,
  ) {
    await this.assertLearnerInScope(apiKey, userId);
    await this.assertCourseInScope(apiKey, courseId);

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
      include: {
        course: { select: { id: true, title: true, slug: true } },
        progress: {
          include: {
            lesson: {
              select: {
                id: true,
                title: true,
                type: true,
                order: true,
                module: { select: { id: true, title: true, order: true } },
              },
            },
          },
        },
      },
    });
    if (!enrollment) throw new NotFoundException('Enrollment not found');

    const progress = await this.buildProgressSummary(enrollment);

    return {
      enrollmentId: enrollment.id,
      status: enrollment.status,
      enrolledAt: enrollment.enrolledAt,
      completedAt: enrollment.completedAt,
      course: enrollment.course,
      progress,
      lessons: enrollment.progress.map((p) => ({
        lessonId: p.lessonId,
        title: p.lesson.title,
        type: p.lesson.type,
        moduleTitle: p.lesson.module.title,
        isCompleted: p.isCompleted,
        completedAt: p.completedAt,
      })),
    };
  }

  async getLearnerCertificates(apiKey: ApiKeyContext, userId: string) {
    await this.assertLearnerInScope(apiKey, userId);

    return this.prisma.certificate.findMany({
      where: {
        userId,
        revokedAt: null,
        ...(apiKey.orgId ? { course: { orgId: apiKey.orgId } } : {}),
      },
      include: {
        course: { select: { id: true, title: true, slug: true } },
      },
      orderBy: { issuedAt: 'desc' },
    });
  }

  async getLearnerAchievements(apiKey: ApiKeyContext, userId: string) {
    await this.assertLearnerInScope(apiKey, userId);
    const all = await this.achievements.getUnifiedForUser(userId);
    return this.filterAchievementsForOrg(apiKey, all);
  }

  private async filterAchievementsForOrg(
    apiKey: ApiKeyContext,
    items: Awaited<ReturnType<AchievementsService['getUnifiedForUser']>>,
  ) {
    if (!apiKey.orgId) return items;
    const orgCourses = await this.prisma.course.findMany({
      where: { orgId: apiKey.orgId },
      select: { title: true, slug: true },
    });
    const titles = new Set(orgCourses.map((c) => c.title));
    const slugs = new Set(orgCourses.map((c) => c.slug));
    return items.filter(
      (a) =>
        a.kind === 'badge' ||
        a.kind === 'custom' ||
        (a.courseSlug && slugs.has(a.courseSlug)) ||
        (a.courseTitle && titles.has(a.courseTitle)),
    );
  }

  private async loadCourseStats(courseIds: string[]) {
    if (!courseIds.length) return new Map();
    const [ratings, durations] = await Promise.all([
      this.prisma.courseReview.groupBy({
        by: ['courseId'],
        where: { courseId: { in: courseIds }, isVisible: true },
        _avg: { rating: true },
        _count: { _all: true },
      }),
      this.prisma.$queryRaw<
        Array<{
          courseId: string;
          totalDuration: number | null;
          lessonCount: number;
        }>
      >`
        SELECT c.id AS "courseId",
               COALESCE(SUM(l.duration), 0)::int AS "totalDuration",
               COUNT(l.id)::int AS "lessonCount"
        FROM "Course" c
        LEFT JOIN "CourseModule" m ON m."courseId" = c.id
        LEFT JOIN "Lesson" l ON l."moduleId" = m.id AND l."isPublished" = true
        WHERE c.id IN (${Prisma.join(courseIds)})
        GROUP BY c.id
      `,
    ]);

    const stats = new Map<
      string,
      {
        avgRating: number | null;
        reviewCount: number;
        totalDurationMinutes: number;
        lessonCount: number;
      }
    >();

    for (const id of courseIds) {
      stats.set(id, {
        avgRating: null,
        reviewCount: 0,
        totalDurationMinutes: 0,
        lessonCount: 0,
      });
    }

    for (const row of ratings) {
      const current = stats.get(row.courseId)!;
      current.avgRating =
        row._avg.rating != null ? Math.round(row._avg.rating * 10) / 10 : null;
      current.reviewCount = row._count._all;
    }

    for (const row of durations) {
      const current = stats.get(row.courseId)!;
      current.totalDurationMinutes = row.totalDuration ?? 0;
      current.lessonCount = row.lessonCount ?? 0;
    }

    return stats;
  }

  private courseOrgWhere(apiKey: ApiKeyContext): Prisma.CourseWhereInput {
    return apiKey.orgId ? { orgId: apiKey.orgId } : {};
  }

  private async assertCourseInScope(apiKey: ApiKeyContext, courseId: string) {
    if (!apiKey.orgId) return;
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { orgId: true },
    });
    if (!course || course.orgId !== apiKey.orgId) {
      throw new NotFoundException('Course not found in organization scope');
    }
  }

  private async assertLearnerInScope(apiKey: ApiKeyContext, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, isActive: true },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('Learner not found');

    if (!apiKey.orgId) return;

    const linked = await this.prisma.enrollment.findFirst({
      where: { userId, course: { orgId: apiKey.orgId } },
      select: { id: true },
    });
    const member = await this.prisma.membership.findFirst({
      where: { userId, orgId: apiKey.orgId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!linked && !member) {
      throw new BadRequestException('Learner not in organization scope');
    }
  }

  private async buildProgressSummary(enrollment: {
    courseId: string;
    progress: Array<{ lessonId: string; isCompleted: boolean }>;
  }) {
    const lessons = await this.prisma.lesson.findMany({
      where: {
        module: { courseId: enrollment.courseId, isPublished: true },
        isPublished: true,
      },
      select: { id: true },
    });
    const totalLessons = lessons.length;
    const completedLessons = enrollment.progress.filter(
      (p) => p.isCompleted,
    ).length;
    const percent =
      totalLessons > 0
        ? Math.round((completedLessons / totalLessons) * 100)
        : 0;

    return {
      totalLessons,
      completedLessons,
      progressPercent: percent,
    };
  }
}
