import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuditAction,
  CertificateRequestStatus,
  EnrollmentStatus,
  UserRole,
} from '@prisma/client';
import { buildPaginatedMeta } from '../../common/dto/pagination.dto';
import { CertificateRequestListQueryDto } from './dto/certificate-request.dto';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';
import {
  buildCertificateProfileUrl,
  buildCertificateVerifyUrl,
  CERTIFICATE_ISSUER_NAME,
  resolveCertificateSettings,
} from '../../common/utils/certificate-settings';
import { EnvConfig } from '../../config/configuration';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../../shared/email/email.service';
import { guardRole } from '../../common/utils/resolve-effective-role';
import { CertificatePdfService } from './certificate-pdf.service';

@Injectable()
export class CertificatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly email: EmailService,
    private readonly pdf: CertificatePdfService,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  async requestCertificate(userId: string, courseId: string, message?: string) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (!enrollment || enrollment.status !== EnrollmentStatus.COMPLETED) {
      throw new BadRequestException(
        'Complete the course before requesting a certificate',
      );
    }

    const existingCert = await this.prisma.certificate.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (existingCert && !existingCert.revokedAt) {
      throw new BadRequestException('Certificate already issued');
    }

    const existing = await this.prisma.certificateRequest.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (existing?.status === CertificateRequestStatus.PENDING) {
      throw new BadRequestException(
        'Certificate request already pending review',
      );
    }
    if (existing?.status === CertificateRequestStatus.APPROVED) {
      throw new BadRequestException('Certificate already approved');
    }

    const request = await this.prisma.certificateRequest.upsert({
      where: { userId_courseId: { userId, courseId } },
      create: {
        userId,
        courseId,
        message,
        status: CertificateRequestStatus.PENDING,
        requestedAt: new Date(),
        reviewedById: null,
        reviewedAt: null,
        reviewNote: null,
      },
      update: {
        message,
        status: CertificateRequestStatus.PENDING,
        requestedAt: new Date(),
        reviewedById: null,
        reviewedAt: null,
        reviewNote: null,
      },
      include: {
        course: { select: { id: true, title: true, slug: true } },
      },
    });

    await this.audit.log({
      userId,
      action: AuditAction.CREATE,
      entity: 'CertificateRequest',
      entityId: request.id,
    });

    return request;
  }

  async getRequestForCourse(userId: string, courseId: string) {
    const [request, certificate] = await Promise.all([
      this.prisma.certificateRequest.findUnique({
        where: { userId_courseId: { userId, courseId } },
      }),
      this.prisma.certificate.findUnique({
        where: { userId_courseId: { userId, courseId } },
        select: { id: true, verifyCode: true, issuedAt: true, revokedAt: true },
      }),
    ]);

    return {
      request,
      certificate: certificate && !certificate.revokedAt ? certificate : null,
    };
  }

  async listPendingForAdmin(
    user: AuthenticatedUser,
    query: CertificateRequestListQueryDto,
  ) {
    const status =
      (query.status as CertificateRequestStatus) ??
      CertificateRequestStatus.PENDING;

    const where: {
      status: CertificateRequestStatus;
      course?: { orgId?: string };
    } = { status };

    if (guardRole(user) === UserRole.ADMIN && user.orgId) {
      where.course = { orgId: user.orgId };
    } else if (query.orgId) {
      where.course = { orgId: query.orgId };
    }

    const [total, rows] = await Promise.all([
      this.prisma.certificateRequest.count({ where }),
      this.prisma.certificateRequest.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          course: {
            select: {
              id: true,
              title: true,
              slug: true,
              org: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { requestedAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
    ]);

    return {
      data: rows,
      meta: buildPaginatedMeta(query.page, query.limit, total),
    };
  }

  async approveRequest(requestId: string, reviewer: AuthenticatedUser) {
    const request = await this.prisma.certificateRequest.findUnique({
      where: { id: requestId },
      include: {
        user: { select: { id: true, email: true } },
        course: { select: { id: true, title: true, slug: true, orgId: true } },
      },
    });
    if (!request) throw new NotFoundException('Certificate request not found');
    if (request.status !== CertificateRequestStatus.PENDING) {
      throw new BadRequestException('Request is not pending');
    }

    this.assertCanReview(reviewer, request.course.orgId);

    const enrollment = await this.prisma.enrollment.findUnique({
      where: {
        userId_courseId: { userId: request.userId, courseId: request.courseId },
      },
    });
    if (!enrollment || enrollment.status !== EnrollmentStatus.COMPLETED) {
      throw new BadRequestException('Student has not completed this course');
    }

    const [updatedRequest, cert] = await this.prisma.$transaction([
      this.prisma.certificateRequest.update({
        where: { id: requestId },
        data: {
          status: CertificateRequestStatus.APPROVED,
          reviewedById: reviewer.userId,
          reviewedAt: new Date(),
        },
      }),
      this.prisma.certificate.upsert({
        where: {
          userId_courseId: {
            userId: request.userId,
            courseId: request.courseId,
          },
        },
        create: { userId: request.userId, courseId: request.courseId },
        update: { revokedAt: null },
        include: {
          course: { select: { title: true, slug: true } },
          user: { select: { firstName: true, lastName: true } },
        },
      }),
    ]);

    await this.audit.log({
      userId: reviewer.userId,
      orgId: request.course.orgId ?? undefined,
      action: AuditAction.APPROVE,
      entity: 'CertificateRequest',
      entityId: request.id,
    });

    void this.email.sendCertificate(
      request.user.email,
      request.course.title,
      cert.verifyCode,
    );

    const pdfUrl = await this.generateCertificatePdf(cert.id);

    return {
      request: updatedRequest,
      certificate: { ...cert, pdfUrl },
    };
  }

  async rejectRequest(
    requestId: string,
    reviewer: AuthenticatedUser,
    reviewNote?: string,
  ) {
    const request = await this.prisma.certificateRequest.findUnique({
      where: { id: requestId },
      include: { course: { select: { orgId: true, title: true } } },
    });
    if (!request) throw new NotFoundException('Certificate request not found');
    if (request.status !== CertificateRequestStatus.PENDING) {
      throw new BadRequestException('Request is not pending');
    }

    this.assertCanReview(reviewer, request.course.orgId);

    const updated = await this.prisma.certificateRequest.update({
      where: { id: requestId },
      data: {
        status: CertificateRequestStatus.REJECTED,
        reviewedById: reviewer.userId,
        reviewedAt: new Date(),
        reviewNote,
      },
    });

    await this.audit.log({
      userId: reviewer.userId,
      orgId: request.course.orgId ?? undefined,
      action: AuditAction.REJECT,
      entity: 'CertificateRequest',
      entityId: request.id,
    });

    return updated;
  }

  private assertCanReview(user: AuthenticatedUser, courseOrgId: string | null) {
    if (user.role === UserRole.SUPERADMIN) return;
    const effectiveRole = guardRole(user);
    if (
      effectiveRole === UserRole.ADMIN &&
      user.orgId &&
      user.orgId === courseOrgId
    ) {
      return;
    }
    throw new BadRequestException(
      'Not allowed to review this certificate request',
    );
  }

  async mine(userId: string) {
    return this.prisma.certificate.findMany({
      where: { userId, revokedAt: null },
      include: {
        course: {
          select: { id: true, title: true, slug: true, thumbnailUrl: true },
        },
      },
      orderBy: { issuedAt: 'desc' },
    });
  }

  async verify(code: string) {
    const cert = await this.prisma.certificate.findFirst({
      where: { verifyCode: code, revokedAt: null },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            isVerified: true,
          },
        },
        course: { select: { title: true, slug: true } },
      },
    });
    if (!cert) throw new NotFoundException('Certificate not found');

    const frontendUrl = this.config.get('FRONTEND_URL', { infer: true });
    const profileUrl = buildCertificateProfileUrl(
      frontendUrl,
      cert.userId,
      cert.verifyCode,
    );

    return {
      valid: true,
      issuedAt: cert.issuedAt,
      verifyCode: cert.verifyCode,
      userId: cert.userId,
      learner: {
        id: cert.user.id,
        name: `${cert.user.firstName} ${cert.user.lastName}`.trim(),
        firstName: cert.user.firstName,
        lastName: cert.user.lastName,
        avatarUrl: cert.user.avatarUrl,
        isVerified: cert.user.isVerified,
      },
      course: {
        title: cert.course.title,
        slug: cert.course.slug,
      },
      profileUrl,
      verifyUrl: buildCertificateVerifyUrl(frontendUrl, cert.verifyCode),
      issuedBy: CERTIFICATE_ISSUER_NAME,
    };
  }

  async getPdfDownload(userId: string, certificateId: string) {
    const cert = await this.prisma.certificate.findUnique({
      where: { id: certificateId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        course: { select: { title: true, slug: true } },
      },
    });
    if (!cert || cert.revokedAt) {
      throw new NotFoundException('Certificate not found');
    }
    if (cert.userId !== userId) {
      throw new ForbiddenException('Not your certificate');
    }

    await this.generateCertificatePdf(cert.id);

    const buffer = this.pdf.readFile(cert.verifyCode);
    const safeCourse = cert.course.title.replace(/[^\w\s-]/g, '').trim();
    const filename = `${safeCourse || 'certificate'}-${cert.verifyCode.slice(0, 8)}.pdf`;

    return { buffer, filename, contentType: 'application/pdf' as const };
  }

  private async generateCertificatePdf(certificateId: string): Promise<string> {
    const cert = await this.prisma.certificate.findUnique({
      where: { id: certificateId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        course: {
          select: {
            title: true,
            org: { select: { name: true, settings: true } },
          },
        },
      },
    });
    if (!cert) throw new NotFoundException('Certificate not found');

    const signatories = resolveCertificateSettings(cert.course.org?.settings);
    const frontendUrl = this.config.get('FRONTEND_URL', { infer: true });
    const verifyUrl = buildCertificateVerifyUrl(frontendUrl, cert.verifyCode);

    await this.pdf.generateAndSave({
      studentName: `${cert.user.firstName} ${cert.user.lastName}`,
      courseTitle: cert.course.title,
      issuedAt: cert.issuedAt,
      verifyCode: cert.verifyCode,
      verifyUrl,
      orgName: CERTIFICATE_ISSUER_NAME,
      programLeaderName: signatories.programLeaderName,
      programLeaderTitle: signatories.programLeaderTitle,
      ceoName: signatories.ceoName,
      ceoTitle: signatories.ceoTitle,
    });

    const pdfUrl = `/api/certificates/download/${cert.id}`;
    await this.prisma.certificate.update({
      where: { id: cert.id },
      data: { pdfUrl },
    });

    return pdfUrl;
  }
}
