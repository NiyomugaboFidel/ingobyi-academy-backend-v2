import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  MembershipStatus,
  NotificationType,
  UserRole,
} from '@prisma/client';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import {
  buildPaginatedMeta,
  PaginationDto,
} from '../../common/dto/pagination.dto';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';
import { uniqueSlug } from '../../common/utils/slug.util';
import { sanitizeUser } from '../../common/utils/sanitize-user';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../../shared/email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AddMemberDto } from './dto/add-member.dto';
import { CreateJoinRequestDto } from './dto/create-join-request.dto';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { JoinRequestDto } from './dto/join-request.dto';
import { ReviewJoinRequestDto } from './dto/review-join-request.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { UpdatePermissionsDto } from './dto/update-permissions.dto';
import { UpdateCertificateSettingsDto } from './dto/update-certificate-settings.dto';
import {
  DEFAULT_CERTIFICATE_SIGNATORIES,
  CERTIFICATE_ISSUER_NAME,
  resolveCertificateSettings,
} from '../../common/utils/certificate-settings';
import { RbacService } from '../rbac/rbac.service';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly email: EmailService,
    private readonly rbac: RbacService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(userId: string, dto: CreateOrganizationDto) {
    const slug = await uniqueSlug(dto.name, async (s) => {
      const found = await this.prisma.organization.findUnique({
        where: { slug: s },
      });
      return !!found;
    });
    const org = await this.prisma.organization.create({
      data: {
        name: dto.name,
        slug,
        type: dto.type,
        description: dto.description,
        logoUrl: dto.logoUrl,
        country: dto.country,
        city: dto.city,
        ownerId: userId,
        memberships: {
          create: {
            userId,
            role: UserRole.ADMIN,
            status: MembershipStatus.ACTIVE,
          },
        },
      },
    });
    await this.rbac.seedOrgPermissions(org.id);
    return org;
  }

  async listMyMemberships(userId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: { userId, status: MembershipStatus.ACTIVE },
      include: {
        org: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
            type: true,
            isActive: true,
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });
    return memberships.map((m) => ({
      organizationId: m.orgId,
      role: m.role,
      status: m.status,
      joinedAt: m.joinedAt,
      org: m.org,
    }));
  }

  async directory(pagination: PaginationDto) {
    const where: Prisma.OrganizationWhereInput = {
      isActive: true,
      isVerified: true,
    };
    const [data, total] = await Promise.all([
      this.prisma.organization.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          slug: true,
          type: true,
          description: true,
          logoUrl: true,
          country: true,
          city: true,
        },
      }),
      this.prisma.organization.count({ where }),
    ]);
    return {
      data,
      meta: buildPaginatedMeta(pagination.page, pagination.limit, total),
    };
  }

  async redeemInvite(token: string, userId: string) {
    const invite = await this.prisma.orgInvite.findUnique({
      where: { token },
      include: { org: { select: { isActive: true, name: true } } },
    });
    if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired invite');
    }
    if (!invite.org.isActive) {
      throw new BadRequestException('Organization is suspended');
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
      throw new ForbiddenException('Invite email does not match your account');
    }

    await this.prisma.$transaction([
      this.prisma.orgInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      }),
      this.prisma.membership.upsert({
        where: { userId_orgId: { userId, orgId: invite.orgId } },
        create: {
          userId,
          orgId: invite.orgId,
          role: invite.role,
          status: MembershipStatus.ACTIVE,
        },
        update: { role: invite.role, status: MembershipStatus.ACTIVE },
      }),
    ]);

    return { message: 'Invite accepted', organizationId: invite.orgId };
  }

  async list(user: AuthenticatedUser, pagination: PaginationDto) {
    const where: Prisma.OrganizationWhereInput =
      user.role === UserRole.SUPERADMIN
        ? { isActive: true }
        : {
            isActive: true,
            memberships: {
              some: {
                userId: user.userId,
                status: MembershipStatus.ACTIVE,
              },
            },
          };
    const [data, total] = await Promise.all([
      this.prisma.organization.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.organization.count({ where }),
    ]);
    return {
      data,
      meta: buildPaginatedMeta(pagination.page, pagination.limit, total),
    };
  }

  async getBySlug(slug: string) {
    const org = await this.prisma.organization.findFirst({
      where: { slug, isActive: true },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async update(id: string, dto: UpdateOrganizationDto) {
    return this.prisma.organization.update({ where: { id }, data: dto });
  }

  async getCertificateSettings(orgId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true, settings: true },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return {
      orgId: org.id,
      orgName: org.name,
      settings: resolveCertificateSettings(org.settings),
      defaults: DEFAULT_CERTIFICATE_SIGNATORIES,
      issuerName: CERTIFICATE_ISSUER_NAME,
    };
  }

  async updateCertificateSettings(
    orgId: string,
    dto: UpdateCertificateSettingsDto,
  ) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { settings: true },
    });
    if (!org) throw new NotFoundException('Organization not found');

    const current =
      org.settings && typeof org.settings === 'object'
        ? (org.settings as Record<string, unknown>)
        : {};
    const existingCert =
      current.certificate && typeof current.certificate === 'object'
        ? (current.certificate as Record<string, unknown>)
        : {};

    const nextCertificate = { ...existingCert };
    for (const [key, value] of Object.entries(dto)) {
      if (typeof value === 'string') {
        nextCertificate[key] = value.trim();
      }
    }

    const updated = await this.prisma.organization.update({
      where: { id: orgId },
      data: {
        settings: {
          ...current,
          certificate: nextCertificate,
        } as Prisma.InputJsonValue,
      },
      select: { id: true, name: true, settings: true },
    });

    return {
      orgId: updated.id,
      orgName: updated.name,
      settings: resolveCertificateSettings(updated.settings),
      issuerName: CERTIFICATE_ISSUER_NAME,
    };
  }

  async softDelete(id: string) {
    return this.prisma.organization.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async listMembers(orgId: string, pagination: PaginationDto) {
    const [data, total] = await Promise.all([
      this.prisma.membership.findMany({
        where: { orgId, status: 'ACTIVE' },
        skip: pagination.skip,
        take: pagination.limit,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
        },
      }),
      this.prisma.membership.count({ where: { orgId, status: 'ACTIVE' } }),
    ]);
    return {
      data: data.map((m) => ({
        ...m,
        user: sanitizeUser(m.user as { passwordHash?: string }),
      })),
      meta: buildPaginatedMeta(pagination.page, pagination.limit, total),
    };
  }

  async invite(orgId: string, dto: InviteMemberDto) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
    });
    const token = randomBytes(24).toString('base64url');
    const invite = await this.prisma.orgInvite.create({
      data: {
        orgId,
        email: dto.email.toLowerCase(),
        role: dto.role,
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    void this.email.sendOrgInvite(
      dto.email,
      org?.name ?? 'Organization',
      dto.role,
      token,
    );
    return invite;
  }

  async createJoinRequest(userId: string, dto: CreateJoinRequestDto) {
    return this.requestJoin(dto.organizationId, userId, {
      message: dto.message,
      requestedRole: dto.requestedRole,
    });
  }

  async listMyJoinRequests(userId: string) {
    return this.prisma.orgJoinRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        org: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
            type: true,
          },
        },
      },
    });
  }

  async requestJoin(orgId: string, userId: string, dto: JoinRequestDto) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
    });
    if (!org?.isActive) {
      throw new BadRequestException('Organization not found or suspended');
    }

    const existing = await this.prisma.membership.findUnique({
      where: { userId_orgId: { userId, orgId } },
    });
    if (existing?.status === MembershipStatus.ACTIVE) {
      throw new BadRequestException('Already a member of this organization');
    }

    const pending = await this.prisma.orgJoinRequest.findFirst({
      where: { orgId, userId, status: 'PENDING' },
    });
    if (pending) {
      throw new BadRequestException(
        'You already have a pending request for this organization',
      );
    }

    const requestedRole = dto.requestedRole ?? UserRole.STUDENT;
    if (
      requestedRole === UserRole.SUPERADMIN ||
      requestedRole === UserRole.ADMIN
    ) {
      throw new BadRequestException('Cannot request admin or superadmin role');
    }

    const [request, user, admins] = await Promise.all([
      this.prisma.orgJoinRequest.create({
        data: {
          orgId,
          userId,
          message: dto.message,
          requestedRole,
        },
      }),
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.membership.findMany({
        where: { orgId, role: UserRole.ADMIN, status: MembershipStatus.ACTIVE },
        include: { user: { select: { email: true } } },
      }),
    ]);
    const requesterName = user
      ? `${user.firstName} ${user.lastName}`
      : 'A user';
    for (const admin of admins) {
      void this.email.sendJoinRequest(
        admin.user.email,
        org.name,
        requesterName,
      );
      void this.notifications.create(
        admin.userId,
        NotificationType.ANNOUNCEMENT,
        `Join request — ${org.name}`,
        `${requesterName} requested to join as ${requestedRole.toLowerCase()}`,
        '/admin/join-requests',
      );
    }

    const superadmins = await this.prisma.user.findMany({
      where: { platformRole: UserRole.SUPERADMIN, isActive: true },
      select: { id: true, email: true },
    });
    for (const sa of superadmins) {
      void this.notifications.create(
        sa.id,
        NotificationType.ANNOUNCEMENT,
        `Org join request — ${org.name}`,
        `${requesterName} requested ${requestedRole.toLowerCase()} access`,
        '/superadmin/join-requests',
      );
    }

    return request;
  }

  async addMember(orgId: string, dto: AddMemberDto, actorId: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user) {
      throw new NotFoundException(
        'No account with this email. Send an invite instead.',
      );
    }

    const membership = await this.prisma.membership.upsert({
      where: { userId_orgId: { userId: user.id, orgId } },
      create: {
        userId: user.id,
        orgId,
        role: dto.role,
        status: MembershipStatus.ACTIVE,
      },
      update: { role: dto.role, status: MembershipStatus.ACTIVE },
    });

    await this.prisma.orgJoinRequest.updateMany({
      where: { orgId, userId: user.id, status: 'PENDING' },
      data: { status: 'APPROVED', reviewedBy: actorId, reviewedAt: new Date() },
    });

    await this.audit.log({
      userId: actorId,
      orgId,
      action: AuditAction.GRANT,
      entity: 'Membership',
      entityId: membership.id,
      metadata: { role: dto.role, email: dto.email },
    });

    return {
      ...membership,
      user: sanitizeUser(user as { passwordHash?: string }),
    };
  }

  async updateMember(
    orgId: string,
    userId: string,
    dto: UpdateMemberDto,
    actorId: string,
  ) {
    const membership = await this.prisma.membership.update({
      where: { userId_orgId: { userId, orgId } },
      data: { role: dto.role },
    });
    await this.audit.log({
      userId: actorId,
      orgId,
      action: AuditAction.GRANT,
      entity: 'Membership',
      entityId: membership.id,
      metadata: { role: dto.role },
    });
    return membership;
  }

  async removeMember(orgId: string, userId: string) {
    return this.prisma.membership.update({
      where: { userId_orgId: { userId, orgId } },
      data: { status: MembershipStatus.SUSPENDED },
    });
  }

  async listJoinRequests(orgId: string) {
    const requests = await this.prisma.orgJoinRequest.findMany({
      where: { orgId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });
    return requests.map((r) => ({
      ...r,
      user: sanitizeUser(r.user as { passwordHash?: string }),
      userName: `${r.user.firstName} ${r.user.lastName}`,
      userEmail: r.user.email,
    }));
  }

  async reviewJoinRequest(
    orgId: string,
    reqId: string,
    dto: ReviewJoinRequestDto,
    reviewerId: string,
  ) {
    const request = await this.prisma.orgJoinRequest.findFirst({
      where: { id: reqId, orgId, status: 'PENDING' },
    });
    if (!request) throw new NotFoundException('Join request not found');

    const [org, requester] = await Promise.all([
      this.prisma.organization.findUnique({ where: { id: orgId } }),
      this.prisma.user.findUnique({
        where: { id: request.userId },
        select: { email: true },
      }),
    ]);

    await this.prisma.orgJoinRequest.update({
      where: { id: reqId },
      data: {
        status: dto.status,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
      },
    });

    if (dto.status === 'APPROVED') {
      const role =
        dto.approvedRole ?? request.requestedRole ?? UserRole.STUDENT;
      await this.prisma.membership.upsert({
        where: { userId_orgId: { userId: request.userId, orgId } },
        create: { userId: request.userId, orgId, role },
        update: { role, status: MembershipStatus.ACTIVE },
      });
    }

    if (requester) {
      void this.email.sendJoinDecision(
        requester.email,
        org?.name ?? 'Organization',
        dto.status === 'APPROVED',
      );
      void this.notifications.create(
        request.userId,
        NotificationType.ANNOUNCEMENT,
        dto.status === 'APPROVED'
          ? `Welcome to ${org?.name ?? 'organization'}`
          : `Join request update — ${org?.name ?? 'organization'}`,
        dto.status === 'APPROVED'
          ? 'Your membership request was approved. Switch workspace from your dashboard.'
          : 'Your membership request was declined.',
        dto.status === 'APPROVED' ? '/onboarding' : '/onboarding',
      );
    }
    return { message: `Request ${dto.status.toLowerCase()}` };
  }

  async getPermissions(orgId: string) {
    return this.prisma.orgPermission.findMany({ where: { orgId } });
  }

  async updatePermissions(orgId: string, dto: UpdatePermissionsDto) {
    for (const entry of dto.permissions) {
      await this.prisma.orgPermission.upsert({
        where: {
          orgId_role_permission: {
            orgId,
            role: entry.role,
            permission: entry.permission,
          },
        },
        create: {
          orgId,
          role: entry.role,
          permission: entry.permission,
          granted: entry.granted,
        },
        update: { granted: entry.granted },
      });
    }
    return this.getPermissions(orgId);
  }

  async assertOrgAdmin(user: AuthenticatedUser, orgId: string) {
    if (user.role === UserRole.SUPERADMIN) return;
    const membership = await this.prisma.membership.findUnique({
      where: { userId_orgId: { userId: user.userId, orgId } },
    });
    const effectiveRole =
      user.orgId === orgId && user.orgRole ? user.orgRole : membership?.role;
    if (
      !membership ||
      membership.status !== MembershipStatus.ACTIVE ||
      effectiveRole !== UserRole.ADMIN
    ) {
      throw new ForbiddenException('Admin access required');
    }
  }
}
