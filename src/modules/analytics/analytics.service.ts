import { Injectable } from '@nestjs/common';
import { stringify } from 'csv-stringify/sync';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async orgDashboard(orgId: string) {
    const [enrollments, completions, members, courses, revenue] =
      await Promise.all([
        this.prisma.enrollment.count({ where: { course: { orgId } } }),
        this.prisma.enrollment.count({
          where: { course: { orgId }, status: 'COMPLETED' },
        }),
        this.prisma.membership.count({ where: { orgId, status: 'ACTIVE' } }),
        this.prisma.course.count({ where: { orgId } }),
        this.orgRevenue(orgId),
      ]);
    return { enrollments, completions, members, courses, revenue };
  }

  async orgRevenue(orgId: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { course: { orgId }, status: { in: ['ACTIVE', 'COMPLETED'] } },
      include: { course: { select: { price: true } } },
    });
    let totalRevenue = 0;
    let paidEnrollments = 0;
    for (const row of enrollments) {
      const price = row.course.price ? Number(row.course.price) : 0;
      if (price > 0) {
        totalRevenue += price;
        paidEnrollments += 1;
      }
    }
    return {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      paidEnrollments,
      currency: 'RWF',
    };
  }

  async trainerDashboard(trainerId: string) {
    const trainerCourses = await this.prisma.courseTrainer.findMany({
      where: { userId: trainerId },
      select: {
        courseId: true,
        course: { select: { id: true, status: true, title: true } },
      },
    });
    const courseIds = trainerCourses.map((row) => row.courseId);

    if (!courseIds.length) {
      return {
        totalCourses: 0,
        publishedCourses: 0,
        totalStudents: 0,
        activeStudents: 0,
        completedEnrollments: 0,
        lessonsCompleted: 0,
        avgRating: null,
        recentEnrollments: [],
        courseBreakdown: [],
      };
    }

    const [
      totalStudents,
      activeStudents,
      completedEnrollments,
      lessonsCompleted,
      recentEnrollments,
      ratingAgg,
      courseBreakdown,
    ] = await Promise.all([
      this.prisma.enrollment.count({ where: { courseId: { in: courseIds } } }),
      this.prisma.enrollment.count({
        where: { courseId: { in: courseIds }, status: 'ACTIVE' },
      }),
      this.prisma.enrollment.count({
        where: { courseId: { in: courseIds }, status: 'COMPLETED' },
      }),
      this.prisma.lessonProgress.count({
        where: {
          enrollment: { courseId: { in: courseIds } },
          isCompleted: true,
        },
      }),
      this.prisma.enrollment.findMany({
        where: { courseId: { in: courseIds } },
        orderBy: { enrolledAt: 'desc' },
        take: 8,
        include: {
          user: { select: { firstName: true, lastName: true } },
          course: { select: { title: true } },
        },
      }),
      this.prisma.courseReview.aggregate({
        where: { courseId: { in: courseIds }, isVisible: true },
        _avg: { rating: true },
        _count: { id: true },
      }),
      Promise.all(
        trainerCourses.map(async (row) => {
          const stats = await this.courseStats(row.courseId);
          return {
            courseId: row.courseId,
            title: row.course.title,
            status: row.course.status,
            ...stats,
          };
        }),
      ),
    ]);

    return {
      totalCourses: courseIds.length,
      publishedCourses: trainerCourses.filter(
        (row) => row.course.status === 'PUBLISHED',
      ).length,
      totalStudents,
      activeStudents,
      completedEnrollments,
      lessonsCompleted,
      avgRating:
        ratingAgg._avg.rating != null
          ? Math.round(ratingAgg._avg.rating * 10) / 10
          : null,
      reviewCount: ratingAgg._count.id,
      recentEnrollments: recentEnrollments.map((row) => ({
        id: row.id,
        studentName: `${row.user.firstName} ${row.user.lastName}`,
        courseTitle: row.course.title,
        status: row.status,
        enrolledAt: row.enrolledAt,
      })),
      courseBreakdown,
    };
  }

  async courseStats(courseId: string) {
    const [enrolled, completed, avgProgress] = await Promise.all([
      this.prisma.enrollment.count({ where: { courseId } }),
      this.prisma.enrollment.count({
        where: { courseId, status: 'COMPLETED' },
      }),
      this.prisma.lessonProgress.count({
        where: { enrollment: { courseId }, isCompleted: true },
      }),
    ]);
    return { enrolled, completed, lessonsCompleted: avgProgress };
  }

  async platformStats() {
    const [users, orgs, courses, enrollments] = await Promise.all([
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.organization.count({ where: { isActive: true } }),
      this.prisma.course.count({ where: { status: 'PUBLISHED' } }),
      this.prisma.enrollment.count(),
    ]);
    return { users, orgs, courses, enrollments };
  }

  async exportOrg(orgId: string, format: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { course: { orgId } },
      include: {
        user: { select: { email: true, firstName: true, lastName: true } },
        course: { select: { title: true } },
      },
    });
    const rows = enrollments.map((e) => ({
      email: e.user.email,
      name: `${e.user.firstName} ${e.user.lastName}`,
      course: e.course.title,
      status: e.status,
      enrolledAt: e.enrolledAt.toISOString(),
    }));

    if (format === 'csv') {
      return {
        contentType: 'text/csv',
        data: stringify(rows, { header: true }),
      };
    }
    if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Enrollments');
      if (rows.length)
        sheet.columns = Object.keys(rows[0]).map((k) => ({
          header: k,
          key: k,
        }));
      sheet.addRows(rows);
      const buffer = await workbook.xlsx.writeBuffer();
      return {
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        data: buffer,
      };
    }
    return {
      contentType: 'application/json',
      data: JSON.stringify(rows, null, 2),
    };
  }
}
