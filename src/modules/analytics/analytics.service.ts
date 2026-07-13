import { Injectable } from '@nestjs/common';
import { stringify } from 'csv-stringify/sync';
import * as ExcelJS from 'exceljs';
import {
  excludeCourseTrainerPairs,
  learnerEnrollmentWhereForCourse,
} from '../../common/utils/learner-enrollment';
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

    const trainerPairs = await this.prisma.courseTrainer.findMany({
      where: { courseId: { in: courseIds } },
      select: { courseId: true, userId: true },
    });

    const [
      totalStudents,
      activeStudents,
      completedEnrollments,
      lessonsCompleted,
      recentEnrollments,
      ratingAgg,
      courseBreakdown,
    ] = await Promise.all([
      this.prisma.enrollment.count({
        where: excludeCourseTrainerPairs(
          { courseId: { in: courseIds } },
          trainerPairs,
        ),
      }),
      this.prisma.enrollment.count({
        where: excludeCourseTrainerPairs(
          { courseId: { in: courseIds }, status: 'ACTIVE' },
          trainerPairs,
        ),
      }),
      this.prisma.enrollment.count({
        where: excludeCourseTrainerPairs(
          { courseId: { in: courseIds }, status: 'COMPLETED' },
          trainerPairs,
        ),
      }),
      this.prisma.lessonProgress.count({
        where: {
          enrollment: excludeCourseTrainerPairs(
            { courseId: { in: courseIds } },
            trainerPairs,
          ),
          isCompleted: true,
        },
      }),
      this.prisma.enrollment.findMany({
        where: excludeCourseTrainerPairs(
          { courseId: { in: courseIds } },
          trainerPairs,
        ),
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
    const where = learnerEnrollmentWhereForCourse(courseId);
    const [enrolled, completed, avgProgress] = await Promise.all([
      this.prisma.enrollment.count({ where }),
      this.prisma.enrollment.count({
        where: learnerEnrollmentWhereForCourse(courseId, {
          status: 'COMPLETED',
        }),
      }),
      this.prisma.lessonProgress.count({
        where: {
          enrollment: learnerEnrollmentWhereForCourse(courseId),
          isCompleted: true,
        },
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

  async trainerWorkOverview(trainerId: string, courseId: string) {
    const access = await this.prisma.courseTrainer.findFirst({
      where: { userId: trainerId, courseId },
      select: {
        courseId: true,
        course: { select: { id: true, title: true } },
      },
    });
    if (!access) {
      return {
        course: null as { id: string; title: string } | null,
        summary: {
          students: 0,
          assignmentsGraded: 0,
          assignmentsPending: 0,
          quizAttempts: 0,
          attendanceMarked: 0,
          presentRate: null as number | null,
        },
        students: [],
      };
    }

    const courseTitle = new Map([[access.course.id, access.course.title]]);

    const trainerPairs = await this.prisma.courseTrainer.findMany({
      where: { courseId },
      select: { courseId: true, userId: true },
    });

    const enrollments = await this.prisma.enrollment.findMany({
      where: excludeCourseTrainerPairs(
        { courseId, status: { in: ['ACTIVE', 'COMPLETED'] } },
        trainerPairs,
      ),
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        course: { select: { id: true, title: true } },
      },
    });

    const lessons = await this.prisma.lesson.findMany({
      where: {
        module: { courseId },
        type: { in: ['ASSIGNMENT', 'QUIZ'] },
      },
      select: {
        id: true,
        title: true,
        type: true,
        module: { select: { courseId: true } },
      },
    });

    const lessonMeta = new Map(
      lessons.map((l) => [
        l.id,
        {
          title: l.title,
          type: l.type,
          courseId: l.module.courseId,
          courseTitle: courseTitle.get(l.module.courseId) ?? 'Course',
        },
      ]),
    );
    const assignmentLessonIds = lessons
      .filter((l) => l.type === 'ASSIGNMENT')
      .map((l) => l.id);
    const quizLessonIds = lessons.filter((l) => l.type === 'QUIZ').map((l) => l.id);

    const [assignments, quizAttempts, sessions] = await Promise.all([
      assignmentLessonIds.length
        ? this.prisma.assignment.findMany({
            where: { lessonId: { in: assignmentLessonIds } },
            include: {
              submissions: {
                include: {
                  user: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      email: true,
                    },
                  },
                },
              },
            },
          })
        : Promise.resolve([]),
      quizLessonIds.length
        ? this.prisma.quizAttempt.findMany({
            where: { lessonId: { in: quizLessonIds } },
            orderBy: { attemptedAt: 'desc' },
            include: { lesson: { select: { id: true, title: true } } },
          })
        : Promise.resolve([]),
      this.prisma.physicalSession.findMany({
        where: { courseId },
        include: {
          attendance: true,
          course: { select: { title: true } },
        },
        orderBy: { startTime: 'desc' },
      }),
    ]);

    type StudentBucket = {
      userId: string;
      name: string;
      email: string;
      courses: Set<string>;
      assignments: Array<{
        title: string;
        courseTitle: string;
        score: number | null;
        maxScore: number;
        status: 'graded' | 'submitted';
        submittedAt: string | null;
      }>;
      quizzes: Array<{
        title: string;
        courseTitle: string;
        score: number;
        isPassed: boolean;
        attemptedAt: string;
      }>;
      attendance: Array<{
        sessionTitle: string;
        courseTitle: string;
        status: string;
        date: string;
      }>;
    };

    const byStudent = new Map<string, StudentBucket>();
    const ensure = (
      userId: string,
      name: string,
      email: string,
      courseName?: string,
    ) => {
      let row = byStudent.get(userId);
      if (!row) {
        row = {
          userId,
          name,
          email,
          courses: new Set(),
          assignments: [],
          quizzes: [],
          attendance: [],
        };
        byStudent.set(userId, row);
      }
      if (courseName) row.courses.add(courseName);
      return row;
    };

    for (const e of enrollments) {
      ensure(
        e.user.id,
        `${e.user.firstName} ${e.user.lastName}`.trim(),
        e.user.email,
        e.course.title,
      );
    }

    let assignmentsGraded = 0;
    let assignmentsPending = 0;
    for (const assignment of assignments) {
      const meta = lessonMeta.get(assignment.lessonId);
      if (!meta) continue;
      for (const sub of assignment.submissions) {
        const student = ensure(
          sub.user.id,
          `${sub.user.firstName} ${sub.user.lastName}`.trim(),
          sub.user.email,
          meta.courseTitle,
        );
        const graded = sub.score != null;
        if (graded) assignmentsGraded += 1;
        else assignmentsPending += 1;
        student.assignments.push({
          title: assignment.title || meta.title,
          courseTitle: meta.courseTitle,
          score: sub.score,
          maxScore: assignment.maxScore,
          status: graded ? 'graded' : 'submitted',
          submittedAt: sub.submittedAt?.toISOString() ?? null,
        });
      }
    }

    const latestQuiz = new Map<string, (typeof quizAttempts)[number]>();
    for (const attempt of quizAttempts) {
      const key = `${attempt.userId}:${attempt.lessonId}`;
      if (!latestQuiz.has(key)) latestQuiz.set(key, attempt);
    }

    const quizUserIds = [...new Set([...latestQuiz.values()].map((a) => a.userId))];
    const attendanceUserIds = [
      ...new Set(sessions.flatMap((s) => s.attendance.map((a) => a.userId))),
    ];
    const extraUserIds = [...new Set([...quizUserIds, ...attendanceUserIds])].filter(
      (id) => !byStudent.has(id),
    );
    if (extraUserIds.length) {
      const extraUsers = await this.prisma.user.findMany({
        where: { id: { in: extraUserIds } },
        select: { id: true, firstName: true, lastName: true, email: true },
      });
      for (const u of extraUsers) {
        ensure(u.id, `${u.firstName} ${u.lastName}`.trim(), u.email);
      }
    }

    for (const attempt of latestQuiz.values()) {
      const meta = lessonMeta.get(attempt.lessonId);
      const student = byStudent.get(attempt.userId);
      if (!meta || !student) continue;
      student.courses.add(meta.courseTitle);
      student.quizzes.push({
        title: attempt.lesson.title,
        courseTitle: meta.courseTitle,
        score: attempt.score,
        isPassed: attempt.isPassed,
        attemptedAt: attempt.attemptedAt.toISOString(),
      });
    }

    let attendanceMarked = 0;
    let presentCount = 0;
    for (const session of sessions) {
      for (const row of session.attendance) {
        attendanceMarked += 1;
        if (row.status === 'PRESENT' || row.status === 'LATE') presentCount += 1;
        const student = byStudent.get(row.userId);
        if (!student) continue;
        student.courses.add(session.course.title);
        student.attendance.push({
          sessionTitle: session.title,
          courseTitle: session.course.title,
          status: row.status,
          date: session.startTime.toISOString(),
        });
      }
    }

    const students = [...byStudent.values()]
      .map((s) => {
        const gradedScores = s.assignments
          .filter((a) => a.score != null)
          .map((a) => (a.score! / Math.max(a.maxScore, 1)) * 100);
        const quizScores = s.quizzes.map((q) => q.score);
        const present = s.attendance.filter(
          (a) => a.status === 'PRESENT' || a.status === 'LATE',
        ).length;
        return {
          userId: s.userId,
          name: s.name,
          email: s.email,
          courses: [...s.courses],
          assignments: s.assignments,
          quizzes: s.quizzes,
          attendance: s.attendance,
          assignmentAvg:
            gradedScores.length > 0
              ? Math.round(
                  gradedScores.reduce((a, b) => a + b, 0) / gradedScores.length,
                )
              : null,
          quizAvg:
            quizScores.length > 0
              ? Math.round(quizScores.reduce((a, b) => a + b, 0) / quizScores.length)
              : null,
          attendanceRate:
            s.attendance.length > 0
              ? Math.round((present / s.attendance.length) * 100)
              : null,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      course: { id: access.course.id, title: access.course.title },
      summary: {
        students: students.length,
        assignmentsGraded,
        assignmentsPending,
        quizAttempts: latestQuiz.size,
        attendanceMarked,
        presentRate:
          attendanceMarked > 0
            ? Math.round((presentCount / attendanceMarked) * 100)
            : null,
      },
      students,
    };
  }
}

