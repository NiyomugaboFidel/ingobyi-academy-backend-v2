import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';
import { ParseCuidPipe } from '../../common/pipes/parse-cuid.pipe';
import { AnalyticsService } from './analytics.service';

@ApiTags('Analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

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
