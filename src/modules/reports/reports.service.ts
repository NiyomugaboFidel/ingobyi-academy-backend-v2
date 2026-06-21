import { Injectable, NotFoundException } from '@nestjs/common';
import { MembershipStatus, Prisma, UserRole } from '@prisma/client';
import {
  buildPaginatedMeta,
  PaginationDto,
} from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../shared/email/email.service';
import { CreateReportDto } from './dto/create-report.dto';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  async create(userId: string, dto: CreateReportDto) {
    const [report, reporter] = await Promise.all([
      this.prisma.issueReport.create({
        data: {
          userId,
          type: dto.type,
          title: dto.title,
          description: dto.description,
          metadata: dto.metadata as Prisma.InputJsonValue | undefined,
        },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      }),
    ]);

    const orgId =
      typeof dto.metadata?.orgId === 'string' ? dto.metadata.orgId : undefined;
    const adminEmails = await this.getModeratorEmails(orgId);
    for (const adminEmail of adminEmails) {
      void this.email.sendReportNew(
        adminEmail,
        dto.title,
        reporter?.email ?? 'unknown',
      );
    }
    return report;
  }

  private async getModeratorEmails(orgId?: string) {
    const emails = new Set<string>();
    const superadmins = await this.prisma.user.findMany({
      where: { platformRole: UserRole.SUPERADMIN, isActive: true },
      select: { email: true },
    });
    for (const u of superadmins) emails.add(u.email);

    if (orgId) {
      const orgAdmins = await this.prisma.membership.findMany({
        where: { orgId, role: UserRole.ADMIN, status: MembershipStatus.ACTIVE },
        include: { user: { select: { email: true } } },
      });
      for (const m of orgAdmins) emails.add(m.user.email);
    }
    return [...emails];
  }

  mine(userId: string) {
    return this.prisma.issueReport.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listAll(pagination: PaginationDto, orgId?: string) {
    const where: Prisma.IssueReportWhereInput = orgId
      ? {
          user: {
            memberships: { some: { orgId, status: MembershipStatus.ACTIVE } },
          },
        }
      : {};
    const [data, total] = await Promise.all([
      this.prisma.issueReport.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      }),
      this.prisma.issueReport.count({ where }),
    ]);
    return {
      data,
      meta: buildPaginatedMeta(pagination.page, pagination.limit, total),
    };
  }

  async resolve(
    id: string,
    resolverId: string,
    status: 'RESOLVED' | 'DISMISSED',
  ) {
    const report = await this.prisma.issueReport.findUnique({
      where: { id },
      include: { user: { select: { email: true } } },
    });
    if (!report) throw new NotFoundException('Report not found');
    const updated = await this.prisma.issueReport.update({
      where: { id },
      data: {
        status,
        resolvedAt: new Date(),
        metadata: {
          ...(typeof report.metadata === 'object' &&
          report.metadata &&
          !Array.isArray(report.metadata)
            ? (report.metadata as Record<string, unknown>)
            : {}),
          resolvedBy: resolverId,
        } as Prisma.InputJsonValue,
      },
    });
    void this.email.sendReportResolved(report.user.email, report.title, status);
    return updated;
  }
}
