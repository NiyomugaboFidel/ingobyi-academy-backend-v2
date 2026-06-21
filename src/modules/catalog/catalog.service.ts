import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CourseStatus, EnrollmentStatus, Prisma } from '@prisma/client';
import {
  buildPaginatedMeta,
  PaginationDto,
} from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  intersectIds,
  resolveCategories,
  resolveDurationRanges,
  resolveLanguages,
  resolveLevels,
} from './catalog-search.helpers';
import { CreateCourseReviewDto } from './dto/create-review.dto';

type CatalogSearchFilters = {
  q?: string;
  category?: string;
  categories?: string;
  level?: string;
  levels?: string;
  type?: string;
  org?: string;
  price?: string;
  sort?: string;
  language?: string;
  ratingMin?: number;
  duration?: string;
};

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async search(pagination: PaginationDto, filters: CatalogSearchFilters) {
    let courseIdFilter: string[] | undefined;

    if (filters.ratingMin && filters.ratingMin > 0) {
      const rated = await this.prisma.courseReview.groupBy({
        by: ['courseId'],
        _avg: { rating: true },
        having: {
          rating: { _avg: { gte: filters.ratingMin } },
        },
      });
      courseIdFilter = intersectIds(
        courseIdFilter,
        rated.map((row) => row.courseId),
      );
    }

    const durationRanges = resolveDurationRanges(filters.duration);
    if (durationRanges.length > 0) {
      const durationIds = await this.findCourseIdsByDuration(durationRanges);
      courseIdFilter = intersectIds(courseIdFilter, durationIds);
    }

    if (courseIdFilter && courseIdFilter.length === 0) {
      return {
        data: [],
        meta: buildPaginatedMeta(pagination.page, pagination.limit, 0),
      };
    }

    const categorySlugs = resolveCategories(
      filters.category,
      filters.categories,
    );
    const levelValues = resolveLevels(filters.level, filters.levels);
    const languageCodes = resolveLanguages(filters.language);

    const where: Prisma.CourseWhereInput = {
      status: CourseStatus.PUBLISHED,
      ...(courseIdFilter ? { id: { in: courseIdFilter } } : {}),
      ...(filters.q
        ? {
            OR: [
              { title: { contains: filters.q, mode: 'insensitive' } },
              { description: { contains: filters.q, mode: 'insensitive' } },
              {
                shortDescription: { contains: filters.q, mode: 'insensitive' },
              },
            ],
          }
        : {}),
      ...(categorySlugs.length === 1
        ? { category: { slug: categorySlugs[0] } }
        : categorySlugs.length > 1
          ? { category: { slug: { in: categorySlugs } } }
          : {}),
      ...(levelValues.length === 1
        ? { level: levelValues[0] }
        : levelValues.length > 1
          ? { level: { in: levelValues } }
          : {}),
      ...(filters.type ? { type: filters.type as never } : {}),
      ...(filters.org ? { org: { slug: filters.org } } : {}),
      ...(filters.price === 'free'
        ? { OR: [{ price: null }, { price: 0 }] }
        : filters.price === 'paid'
          ? { price: { gt: 0 } }
          : {}),
      ...(languageCodes.length === 1
        ? { language: languageCodes[0] }
        : languageCodes.length > 1
          ? { language: { in: languageCodes } }
          : {}),
    };

    const orderBy = this.resolveOrderBy(filters.sort, Boolean(filters.q));

    const [rows, total] = await Promise.all([
      this.prisma.course.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy,
        select: {
          id: true,
          title: true,
          slug: true,
          shortDescription: true,
          thumbnailUrl: true,
          level: true,
          type: true,
          price: true,
          language: true,
          tags: true,
          publishedAt: true,
          org: { select: { name: true, slug: true } },
          category: { select: { name: true, slug: true } },
          _count: { select: { enrollments: true, reviews: true } },
        },
      }),
      this.prisma.course.count({ where }),
    ]);

    const stats = await this.loadCourseStats(rows.map((row) => row.id));
    const data = rows.map((row) => {
      const extra = stats.get(row.id);
      return {
        ...row,
        avgRating: extra?.avgRating ?? null,
        reviewCount: extra?.reviewCount ?? row._count.reviews,
        totalDurationMinutes: extra?.totalDurationMinutes ?? 0,
        lessonCount: extra?.lessonCount ?? 0,
      };
    });

    return {
      data,
      meta: buildPaginatedMeta(pagination.page, pagination.limit, total),
    };
  }

  private resolveOrderBy(
    sort: string | undefined,
    hasQuery: boolean,
  ):
    | Prisma.CourseOrderByWithRelationInput
    | Prisma.CourseOrderByWithRelationInput[] {
    switch (sort) {
      case 'title':
        return { title: 'asc' };
      case 'popular':
        return { enrollments: { _count: 'desc' } };
      case 'relevance':
        return hasQuery
          ? [{ publishedAt: 'desc' }, { title: 'asc' }]
          : { publishedAt: 'desc' };
      case 'newest':
      default:
        return { publishedAt: 'desc' };
    }
  }

  private async findCourseIdsByDuration(
    ranges: Array<{ min: number; max: number | null }>,
  ): Promise<string[]> {
    const conditions = ranges.map((range) => {
      if (range.max == null) {
        return Prisma.sql`COALESCE(SUM(l.duration), 0) >= ${range.min}`;
      }
      return Prisma.sql`COALESCE(SUM(l.duration), 0) >= ${range.min} AND COALESCE(SUM(l.duration), 0) < ${range.max}`;
    });

    const havingClause = Prisma.join(conditions, ' OR ');
    const rows = await this.prisma.$queryRaw<
      Array<{ courseId: string }>
    >(Prisma.sql`
      SELECT c.id AS "courseId"
      FROM "Course" c
      LEFT JOIN "CourseModule" m ON m."courseId" = c.id
      LEFT JOIN "Lesson" l ON l."moduleId" = m.id AND l."isPublished" = true
      WHERE c.status = 'PUBLISHED'
      GROUP BY c.id
      HAVING ${havingClause}
    `);

    return rows.map((row) => row.courseId);
  }

  private async loadCourseStats(courseIds: string[]) {
    const stats = new Map<
      string,
      {
        avgRating: number | null;
        reviewCount: number;
        totalDurationMinutes: number;
        lessonCount: number;
      }
    >();

    if (!courseIds.length) return stats;

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
      >(Prisma.sql`
        SELECT c.id AS "courseId",
               COALESCE(SUM(l.duration), 0)::int AS "totalDuration",
               COUNT(l.id)::int AS "lessonCount"
        FROM "Course" c
        LEFT JOIN "CourseModule" m ON m."courseId" = c.id
        LEFT JOIN "Lesson" l ON l."moduleId" = m.id AND l."isPublished" = true
        WHERE c.id IN (${Prisma.join(courseIds)})
        GROUP BY c.id
      `),
    ]);

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

  async getBySlug(slug: string) {
    const course = await this.prisma.course.findFirst({
      where: { slug, status: CourseStatus.PUBLISHED },
      include: {
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
        category: true,
        org: { select: { id: true, name: true, slug: true, logoUrl: true } },
        modules: {
          where: { isPublished: true },
          include: {
            lessons: {
              where: { isPublished: true },
              select: {
                id: true,
                title: true,
                type: true,
                duration: true,
                isFree: true,
                order: true,
              },
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { order: 'asc' },
        },
        reviews: {
          where: { isVisible: true },
          take: 20,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
                platformRole: true,
                isVerified: true,
              },
            },
          },
        },
      },
    });
    if (!course) throw new NotFoundException('Course not found');

    const stats = await this.loadCourseStats([course.id]);
    const extra = stats.get(course.id);
    const ratingDistribution = await this.getRatingDistribution(course.id);

    return {
      ...course,
      avgRating: extra?.avgRating ?? null,
      reviewCount: extra?.reviewCount ?? course.reviews.length,
      totalDurationMinutes: extra?.totalDurationMinutes ?? 0,
      lessonCount: extra?.lessonCount ?? 0,
      ratingDistribution,
    };
  }

  async submitReview(
    userId: string,
    courseId: string,
    dto: CreateCourseReviewDto,
  ) {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, status: CourseStatus.PUBLISHED },
      select: { id: true, title: true },
    });
    if (!course) throw new NotFoundException('Course not found');

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (!enrollment || enrollment.status !== EnrollmentStatus.COMPLETED) {
      throw new BadRequestException(
        'Complete the course before leaving a review',
      );
    }

    return this.prisma.courseReview.upsert({
      where: { userId_courseId: { userId, courseId } },
      create: {
        userId,
        courseId,
        rating: dto.rating,
        comment: dto.comment,
      },
      update: {
        rating: dto.rating,
        comment: dto.comment,
        isVisible: true,
      },
      include: {
        user: {
          select: { firstName: true, lastName: true, avatarUrl: true },
        },
      },
    });
  }

  async getMyReview(userId: string, courseId: string) {
    return this.prisma.courseReview.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
  }

  async getRatingDistribution(courseId: string) {
    const rows = await this.prisma.courseReview.groupBy({
      by: ['rating'],
      where: { courseId, isVisible: true },
      _count: { id: true },
    });
    const byStar = new Map(rows.map((r) => [r.rating, r._count.id]));
    return [5, 4, 3, 2, 1].map((star) => ({
      star,
      count: byStar.get(star) ?? 0,
    }));
  }

  listCategories() {
    return this.prisma.courseCategory.findMany({
      include: { children: true },
      where: { parentId: null },
      orderBy: { name: 'asc' },
    });
  }

  featured() {
    return this.prisma.course.findMany({
      where: { status: CourseStatus.PUBLISHED, isFeatured: true },
      take: 12,
      select: {
        id: true,
        title: true,
        slug: true,
        thumbnailUrl: true,
        shortDescription: true,
        price: true,
      },
    });
  }

  async suggestions(q?: string) {
    const query = q?.trim() ?? '';
    const courseSelect = {
      id: true,
      title: true,
      slug: true,
      thumbnailUrl: true,
      shortDescription: true,
      level: true,
      price: true,
      tags: true,
      category: { select: { name: true, slug: true } },
      org: { select: { name: true, slug: true } },
      _count: { select: { enrollments: true } },
    } as const;

    if (!query) {
      const [featuredCourses, popularCourses, categories] = await Promise.all([
        this.prisma.course.findMany({
          where: { status: CourseStatus.PUBLISHED, isFeatured: true },
          take: 4,
          orderBy: { publishedAt: 'desc' },
          select: courseSelect,
        }),
        this.prisma.course.findMany({
          where: { status: CourseStatus.PUBLISHED },
          take: 4,
          orderBy: { enrollments: { _count: 'desc' } },
          select: courseSelect,
        }),
        this.prisma.courseCategory.findMany({
          where: { parentId: null },
          take: 6,
          orderBy: { name: 'asc' },
          select: {
            name: true,
            slug: true,
            _count: { select: { courses: true } },
          },
        }),
      ]);

      const courses = (
        featuredCourses.length ? featuredCourses : popularCourses
      ).slice(0, 6);
      const topics = [
        ...new Set(
          courses.flatMap((course) => course.tags ?? []).filter(Boolean),
        ),
      ].slice(0, 8);

      return {
        query: '',
        courses: courses.map((course) => this.mapSuggestionCourse(course)),
        categories: categories.map((category) => ({
          name: category.name,
          slug: category.slug,
          courseCount: category._count.courses,
        })),
        topics,
        popularTerms: [
          ...categories.slice(0, 4).map((category) => category.name),
          ...courses.slice(0, 3).map((course) => course.title),
        ].slice(0, 8),
      };
    }

    const searchWhere: Prisma.CourseWhereInput = {
      status: CourseStatus.PUBLISHED,
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { shortDescription: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { tags: { has: query } },
        { category: { name: { contains: query, mode: 'insensitive' } } },
        { org: { name: { contains: query, mode: 'insensitive' } } },
      ],
    };

    const [courses, categories, tagCourses] = await Promise.all([
      this.prisma.course.findMany({
        where: searchWhere,
        take: 6,
        orderBy: [{ enrollments: { _count: 'desc' } }, { title: 'asc' }],
        select: courseSelect,
      }),
      this.prisma.courseCategory.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { slug: { contains: query, mode: 'insensitive' } },
          ],
        },
        take: 4,
        orderBy: { name: 'asc' },
        select: {
          name: true,
          slug: true,
          _count: { select: { courses: true } },
        },
      }),
      this.prisma.course.findMany({
        where: {
          status: CourseStatus.PUBLISHED,
          tags: { hasSome: [query] },
        },
        take: 12,
        select: { tags: true },
      }),
    ]);

    const topics = [
      ...new Set(
        [
          ...courses.flatMap((course) => course.tags ?? []),
          ...tagCourses.flatMap((course) => course.tags ?? []),
          ...categories.map((category) => category.name),
        ].filter(Boolean),
      ),
    ]
      .filter(
        (topic) =>
          topic.toLowerCase().includes(query.toLowerCase()) || query.length < 3,
      )
      .slice(0, 8);

    const popularTerms = [
      query,
      ...categories.map((category) => category.name),
      ...courses.slice(0, 3).map((course) => course.title),
      ...topics,
    ]
      .filter((term, index, arr) => term && arr.indexOf(term) === index)
      .slice(0, 8);

    return {
      query,
      courses: courses.map((course) => this.mapSuggestionCourse(course)),
      categories: categories.map((category) => ({
        name: category.name,
        slug: category.slug,
        courseCount: category._count.courses,
      })),
      topics,
      popularTerms,
    };
  }

  private mapSuggestionCourse(course: {
    id: string;
    title: string;
    slug: string;
    thumbnailUrl: string | null;
    shortDescription: string | null;
    level: string;
    price: Prisma.Decimal | null;
    category: { name: string; slug: string } | null;
    org: { name: string; slug: string } | null;
    _count: { enrollments: number };
  }) {
    return {
      id: course.id,
      title: course.title,
      slug: course.slug,
      thumbnailUrl: course.thumbnailUrl,
      shortDescription: course.shortDescription,
      level: course.level,
      price: course.price != null ? course.price.toString() : null,
      category: course.category,
      org: course.org,
      enrollmentCount: course._count.enrollments,
    };
  }
}
