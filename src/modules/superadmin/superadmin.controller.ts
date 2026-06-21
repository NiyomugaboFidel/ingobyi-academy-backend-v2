import { Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { ParseCuidPipe } from '../../common/pipes/parse-cuid.pipe';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { CoursesService } from '../courses/courses.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';
import { buildPaginatedMeta } from '../../common/dto/pagination.dto';

@ApiTags('Superadmin')
@Controller('superadmin')
@Roles(UserRole.SUPERADMIN)
export class SuperadminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
    private readonly courses: CoursesService,
  ) {}

  @Get('orgs')
  @ApiOperation({ summary: 'All organizations' })
  async orgs(@Query() pagination: PaginationDto) {
    const [data, total] = await Promise.all([
      this.prisma.organization.findMany({
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.organization.count(),
    ]);
    return {
      data,
      meta: buildPaginatedMeta(pagination.page, pagination.limit, total),
    };
  }

  @Get('users')
  @ApiOperation({ summary: 'All users' })
  async users(@Query() pagination: PaginationDto) {
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        skip: pagination.skip,
        take: pagination.limit,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          platformRole: true,
          isActive: true,
          isVerified: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count(),
    ]);
    return {
      data,
      meta: buildPaginatedMeta(pagination.page, pagination.limit, total),
    };
  }

  @Patch('users/:id/activate')
  @ApiOperation({ summary: 'Activate user' })
  activate(@Param('id', ParseCuidPipe) id: string) {
    return this.prisma.user.update({ where: { id }, data: { isActive: true } });
  }

  @Patch('users/:id/deactivate')
  @ApiOperation({ summary: 'Deactivate user' })
  deactivate(@Param('id', ParseCuidPipe) id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
  }

  @Get('courses/pending')
  @ApiOperation({ summary: 'Courses pending review' })
  pending(@Query() pagination: PaginationDto) {
    return this.courses.listPendingPaginated(pagination);
  }

  @Post('courses/:id/approve')
  @ApiOperation({ summary: 'Approve course' })
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseCuidPipe) id: string,
  ) {
    return this.courses.approve(id, user);
  }

  @Post('courses/:id/reject')
  @ApiOperation({ summary: 'Reject course' })
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseCuidPipe) id: string,
  ) {
    return this.courses.reject(id, user);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Platform KPIs' })
  stats() {
    return this.analytics.platformStats();
  }
}
