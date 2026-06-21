import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomInt } from 'crypto';
import { Response } from 'express';
import { AuditAction, UserRole } from '@prisma/client';
import { parseDurationToMs } from '../../common/utils/parse-duration';
import { EnvConfig } from '../../config/configuration';
import { resolveWorkspace } from '../../common/utils/resolve-effective-role';
import { sanitizeUser } from '../../common/utils/sanitize-user';
import { JwtPayload } from '../../common/interfaces/request-with-user.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService, OtpPurpose } from '../../shared/email/email.service';
import { AuditService } from '../audit/audit.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

const REFRESH_COOKIE = 'ia_refresh';
const OTP_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<EnvConfig, true>,
    private readonly email: EmailService,
    private readonly audit: AuditService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing?.isVerified) {
      throw new BadRequestException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = existing
      ? await this.prisma.user.update({
          where: { id: existing.id },
          data: {
            passwordHash,
            firstName: dto.firstName,
            lastName: dto.lastName,
          },
        })
      : await this.prisma.user.create({
          data: {
            email: dto.email.toLowerCase(),
            passwordHash,
            firstName: dto.firstName,
            lastName: dto.lastName,
          },
        });

    await this.sendOtp(user.email, user.id, 'VERIFY_EMAIL');
    return { message: 'OTP sent to email', email: user.email };
  }

  async verifyOtp(
    email: string,
    code: string,
    res: Response,
    purpose: OtpPurpose = 'VERIFY_EMAIL',
  ) {
    const challenge = await this.validateOtp(email, code, purpose);
    if (purpose === 'RESET_PASSWORD') {
      return { message: 'OTP valid', email: email.toLowerCase() };
    }
    const user = await this.prisma.user.update({
      where: { email: email.toLowerCase() },
      data: { isVerified: true },
    });
    await this.prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { usedAt: new Date() },
    });
    return this.issueTokens(user.id, res);
  }

  async login(dto: LoginDto, res: Response, ip?: string, ua?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user?.passwordHash || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    if (!user.isVerified) {
      await this.sendOtp(user.email, user.id, 'VERIFY_EMAIL');
      throw new UnauthorizedException('Email not verified. OTP resent.');
    }
    await this.audit.log({
      userId: user.id,
      action: AuditAction.LOGIN,
      entity: 'User',
      entityId: user.id,
      ipAddress: ip,
      userAgent: ua,
    });
    return this.issueTokens(user.id, res);
  }

  async refresh(refreshToken: string | undefined, res: Response) {
    if (!refreshToken) throw new UnauthorizedException('No refresh token');
    const tokenHash = this.hashToken(refreshToken);
    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!session || session.expiresAt < new Date() || !session.user.isActive) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    await this.prisma.refreshSession.delete({ where: { id: session.id } });
    return this.issueTokens(session.userId, res);
  }

  async logout(
    refreshToken: string | undefined,
    res: Response,
    userId?: string,
  ) {
    if (refreshToken) {
      const tokenHash = this.hashToken(refreshToken);
      await this.prisma.refreshSession.deleteMany({ where: { tokenHash } });
    }
    this.clearRefreshCookie(res);
    if (userId) {
      await this.audit.log({
        userId,
        action: AuditAction.LOGOUT,
        entity: 'User',
        entityId: userId,
      });
    }
    return { message: 'Logged out' };
  }

  async resendOtp(email: string, purpose: OtpPurpose) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (!user) {
      return { message: 'If the email exists, an OTP has been sent' };
    }
    if (purpose === 'VERIFY_EMAIL' && user.isVerified) {
      throw new BadRequestException('Email already verified');
    }
    await this.sendOtp(user.email, user.id, purpose);
    return { message: 'OTP sent to email', email: user.email };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    return this.resendOtp(dto.email, 'RESET_PASSWORD');
  }

  async resetPassword(dto: ResetPasswordDto) {
    const challenge = await this.validateOtp(
      dto.email,
      dto.code,
      'RESET_PASSWORD',
    );
    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({
      where: { email: dto.email.toLowerCase() },
      data: {
        passwordHash,
        refreshTokenVersion: { increment: 1 },
      },
    });
    await this.prisma.refreshSession.deleteMany({
      where: { user: { email: dto.email.toLowerCase() } },
    });
    await this.prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { usedAt: new Date() },
    });
    return { message: 'Password reset successful' };
  }

  async switchOrg(userId: string, orgId: string, res: Response) {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_orgId: { userId, orgId } },
      include: { org: { select: { isActive: true } } },
    });
    if (!membership || membership.status !== 'ACTIVE') {
      throw new UnauthorizedException('Not a member of this organization');
    }
    if (!membership.org.isActive) {
      throw new UnauthorizedException('Organization is suspended');
    }
    return this.issueTokens(userId, res, orgId);
  }

  async getMe(user: {
    userId: string;
    orgId?: string;
    orgRole?: UserRole;
    role: UserRole;
  }) {
    const dbUser = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.userId, isActive: true },
      include: {
        memberships: {
          where: { status: 'ACTIVE' },
          select: {
            role: true,
            orgId: true,
            status: true,
            joinedAt: true,
            org: {
              select: {
                id: true,
                name: true,
                slug: true,
                logoUrl: true,
                isActive: true,
              },
            },
          },
        },
      },
    });
    const sanitized = sanitizeUser(dbUser);
    return {
      ...sanitized,
      activeOrgId: user.orgId ?? null,
      activeOrgRole: user.orgRole ?? null,
    };
  }

  async handleGoogleUser(
    profile: {
      googleId: string;
      email: string;
      firstName: string;
      lastName: string;
      avatarUrl?: string;
    },
    res: Response,
  ) {
    let user = await this.prisma.user.findFirst({
      where: { OR: [{ googleId: profile.googleId }, { email: profile.email }] },
    });
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          googleId: profile.googleId,
          email: profile.email,
          firstName: profile.firstName,
          lastName: profile.lastName,
          avatarUrl: profile.avatarUrl,
          isVerified: true,
          passwordHash: null,
        },
      });
    } else if (!user.googleId) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { googleId: profile.googleId, isVerified: true },
      });
    }
    return this.issueTokens(user.id, res);
  }

  private async issueTokens(
    userId: string,
    res: Response,
    preferredOrgId?: string,
  ) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        memberships: {
          where: { status: 'ACTIVE', org: { isActive: true } },
          include: {
            org: {
              select: { id: true, name: true, slug: true, logoUrl: true },
            },
          },
        },
      },
    });

    const workspace = resolveWorkspace(
      user.platformRole,
      user.memberships,
      preferredOrgId,
    );

    const payload: JwtPayload = {
      sub: userId,
      role: workspace.platformRole,
      orgId: workspace.orgId,
      orgRole: workspace.orgRole,
      rv: user.refreshTokenVersion,
    };
    const accessToken = this.jwt.sign(payload);
    const refreshToken = randomBytes(48).toString('base64url');
    const refreshMs = parseDurationToMs(
      this.config.get('REFRESH_EXPIRES_IN', { infer: true }),
      180,
    );
    const expiresAt = new Date(Date.now() + refreshMs);

    await this.prisma.refreshSession.create({
      data: {
        userId,
        tokenHash: this.hashToken(refreshToken),
        expiresAt,
      },
    });

    this.setRefreshCookie(res, refreshToken);
    const sanitized = sanitizeUser(user);
    return {
      accessToken,
      activeOrgId: workspace.orgId ?? null,
      activeOrgRole: workspace.orgRole ?? null,
      user: {
        ...sanitized,
        activeOrgId: workspace.orgId ?? null,
        activeOrgRole: workspace.orgRole ?? null,
      },
    };
  }

  private async sendOtp(email: string, userId: string | null, purpose: string) {
    const recent = await this.prisma.otpChallenge.count({
      where: {
        email: email.toLowerCase(),
        createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) },
      },
    });
    if (recent >= 5) throw new BadRequestException('Too many OTP requests');

    const code = String(randomInt(100000, 999999));
    await this.prisma.otpChallenge.create({
      data: {
        userId,
        email: email.toLowerCase(),
        code,
        purpose,
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    });
    await this.email.sendOtp(email, code, purpose as OtpPurpose);
  }

  private async validateOtp(email: string, code: string, purpose: string) {
    const challenge = await this.prisma.otpChallenge.findFirst({
      where: {
        email: email.toLowerCase(),
        code,
        purpose,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!challenge) throw new BadRequestException('Invalid or expired OTP');
    return challenge;
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private cookieOptions() {
    const domain = this.config.get('COOKIE_DOMAIN', { infer: true });
    return {
      httpOnly: true as const,
      secure: this.config.get('COOKIE_SECURE', { infer: true }),
      sameSite: 'lax' as const,
      path: '/api/auth',
      ...(domain ? { domain } : {}),
    };
  }

  private setRefreshCookie(res: Response, token: string) {
    const refreshMs = parseDurationToMs(
      this.config.get('REFRESH_EXPIRES_IN', { infer: true }),
      180,
    );
    res.cookie(REFRESH_COOKIE, token, {
      ...this.cookieOptions(),
      maxAge: refreshMs,
    });
  }

  private clearRefreshCookie(res: Response) {
    res.clearCookie(REFRESH_COOKIE, this.cookieOptions());
  }
}
