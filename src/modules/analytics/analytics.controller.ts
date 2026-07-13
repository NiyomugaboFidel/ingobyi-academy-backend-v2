import {
  Controller,
  Get,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';
import { ParseCuidPipe } from '../../common/pipes/parse-cuid.pipe';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsService } from './analytics.service';
import { TrainerReportPdfService } from './trainer-report-pdf.service';

@ApiTags('Analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly trainerReportPdf: TrainerReportPdfService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('org/:orgId')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Org dashboard' })
  orgDashboard(@Param('orgId', ParseCuidPipe) orgId: string) {
    return this.analyticsService.orgDashboard(orgId);
  }

  @Get('trainer/me')
  @Roles(UserRole.TRAINER, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Trainer dashboard analytics' })
  trainerDashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.analyticsService.trainerDashboard(user.userId);
  }

  @Get('trainer/work-overview')
  @Roles(UserRole.TRAINER, UserRole.SUPERADMIN)
  @ApiOperation({
    summary: 'Trainer work overview for one course (assignments, tests, attendance)',
  })
  trainerWorkOverview(
    @CurrentUser() user: AuthenticatedUser,
    @Query('courseId', ParseCuidPipe) courseId: string,
  ) {
    return this.analyticsService.trainerWorkOverview(user.userId, courseId);
  }

  @Get('trainer/work-overview/report')
  @Roles(UserRole.TRAINER, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Download per-course work overview PDF report (pdfkit)' })
  async trainerWorkOverviewReport(
    @CurrentUser() user: AuthenticatedUser,
    @Query('courseId', ParseCuidPipe) courseId: string,
    @Res() res: Response,
  ) {
    const overview = await this.analyticsService.trainerWorkOverview(
      user.userId,
      courseId,
    );
    const trainer = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: { firstName: true, lastName: true },
    });
    const trainerName = trainer
      ? `${trainer.firstName} ${trainer.lastName}`.trim()
      : 'Trainer';
    const courseTitle = overview.course?.title ?? 'Course';

    const pdf = await this.trainerReportPdf.renderWorkOverview({
      trainerName,
      courseTitle,
      generatedAt: new Date(),
      summary: overview.summary,
      students: overview.students.map((s) => ({
        name: s.name,
        email: s.email,
        assignmentAvg: s.assignmentAvg != null ? `${s.assignmentAvg}%` : '—',
        quizAvg: s.quizAvg != null ? `${s.quizAvg}%` : '—',
        attendanceRate: s.attendanceRate != null ? `${s.attendanceRate}%` : '—',
        assignmentLines: s.assignments.map((a) =>
          a.score != null
            ? `${a.title}: ${a.score}/${a.maxScore}`
            : `${a.title}: submitted, not graded`,
        ),
        quizLines: s.quizzes.map(
          (q) =>
            `${q.title}: ${q.score}%${q.isPassed ? ' · passed' : ' · failed'}`,
        ),
        attendanceLines: s.attendance.map(
          (a) =>
            `${a.sessionTitle} — ${a.status} · ${new Date(a.date).toLocaleDateString()}`,
        ),
      })),
    });

    const slug = courseTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="work-overview-${slug || 'course'}-${new Date().toISOString().slice(0, 10)}.pdf"`,
    );
    res.send(pdf);
  }

  @Get('course/:courseId')
  @Roles(UserRole.ADMIN, UserRole.TRAINER, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Course stats' })
  courseStats(@Param('courseId', ParseCuidPipe) courseId: string) {
    return this.analyticsService.courseStats(courseId);
  }

  @Get('export/:orgId')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Export org data' })
  async export(
    @Param('orgId', ParseCuidPipe) orgId: string,
    @Query('format') format = 'csv',
    @Res() res: Response,
  ) {
    const result = await this.analyticsService.exportOrg(orgId, format);
    res.setHeader('Content-Type', result.contentType);
    res.send(result.data);
  }

  @Get('platform')
  @Roles(UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Platform stats' })
  platform() {
    return this.analyticsService.platformStats();
  }
}
