import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { ParseCuidPipe } from '../../common/pipes/parse-cuid.pipe';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { CoursesService } from '../courses/courses.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';
import { buildPaginatedMeta } from '../../common/dto/pagination.dto';
import { CreatePlatformUserDto } from './dto/create-platform-user.dto';
import { UpdatePlatformUserDto } from './dto/update-platform-user.dto';

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

  @Post('users')
  @ApiOperation({ summary: 'Create a verified platform user (no email OTP)' })
  async createUser(@Body() dto: CreatePlatformUserDto) {
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new BadRequestException('Email already registered');
    }

    const platformRole = dto.platformRole ?? UserRole.STUDENT;
    if (platformRole === UserRole.SUPERADMIN) {
      throw new BadRequestException('Cannot create superadmin via this endpoint');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        platformRole,
        isVerified: true,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        platformRole: true,
        isVerified: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (dto.organizationId) {
      const orgRole = dto.orgRole ?? UserRole.STUDENT;
      if (orgRole === UserRole.SUPERADMIN) {
        throw new BadRequestException('Cannot assign superadmin org role');
      }
      await this.prisma.membership.upsert({
        where: {
          userId_orgId: { userId: user.id, orgId: dto.organizationId },
        },
        create: {
          userId: user.id,
          orgId: dto.organizationId,
          role: orgRole,
        },
        update: { role: orgRole, status: 'ACTIVE' },
      });
    } else {
      const defaultOrg = await this.prisma.organization.findFirst({
        where: { slug: 'ingobyi-innovation-hub', isActive: true },
      });
      if (defaultOrg) {
        const orgRole = dto.orgRole ?? UserRole.STUDENT;
        await this.prisma.membership.upsert({
          where: { userId_orgId: { userId: user.id, orgId: defaultOrg.id } },
          create: { userId: user.id, orgId: defaultOrg.id, role: orgRole },
          update: { role: orgRole, status: 'ACTIVE' },
        });
      }
    }

    return user;
  }

  @Patch('users/:id')
  @ApiOperation({ summary: 'Update platform user' })
  async updateUser(
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: UpdatePlatformUserDto,
  ) {
    if (dto.platformRole === UserRole.SUPERADMIN) {
      throw new BadRequestException('Cannot assign superadmin role');
    }

    const data: Record<string, unknown> = {};
    if (dto.firstName !== undefined) data.firstName = dto.firstName.trim();
    if (dto.lastName !== undefined) data.lastName = dto.lastName.trim();
    if (dto.platformRole !== undefined) data.platformRole = dto.platformRole;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.isVerified !== undefined) data.isVerified = dto.isVerified;
    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, 12);
      data.refreshTokenVersion = { increment: 1 };
    }

    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        platformRole: true,
        isVerified: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  @Post('users/:id/revoke-sessions')
  @ApiOperation({ summary: 'Sign user out everywhere (revoke all sessions)' })
  async revokeSessions(@Param('id', ParseCuidPipe) id: string) {
    await this.prisma.refreshSession.deleteMany({ where: { userId: id } });
    await this.prisma.user.update({
      where: { id },
      data: { refreshTokenVersion: { increment: 1 } },
    });
    return { message: 'All sessions revoked' };
  }

  @Patch('users/:id/activate')
  @ApiOperation({ summary: 'Activate user' })
  activate(@Param('id', ParseCuidPipe) id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { isActive: true, isVerified: true },
    });
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
