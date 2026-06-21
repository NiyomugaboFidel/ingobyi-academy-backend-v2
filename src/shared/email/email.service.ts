import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { EnvConfig } from '../../config/configuration';
import * as templates from './email.templates';

export type OtpPurpose = 'VERIFY_EMAIL' | 'RESET_PASSWORD';

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private readonly isDev: boolean;

  constructor(private readonly config: ConfigService<EnvConfig, true>) {
    this.isDev = config.get('NODE_ENV', { infer: true }) !== 'production';
    const host = config.get('SMTP_HOST', { infer: true });
    const user = config.get('SMTP_USER', { infer: true });
    const pass = config.get('SMTP_PASS', { infer: true });
    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port: config.get('SMTP_PORT', { infer: true }) ?? 587,
        secure: false,
        auth: { user, pass },
      });
    } else if (this.isDev) {
      this.logger.warn(
        'SMTP not configured — OTP codes will be logged to console in development',
      );
    }
  }

  async onModuleInit(): Promise<void> {
    if (!this.transporter) return;
    try {
      await this.transporter.verify();
      const from =
        this.config.get('SMTP_FROM', { infer: true }) ?? 'noreply@ingobyi.com';
      this.logger.log(
        `SMTP ready (${this.config.get('SMTP_HOST', { infer: true })}, from: ${from})`,
      );
    } catch (err) {
      this.logger.error(
        `SMTP verification failed: ${(err as Error).message}. Check SMTP_HOST, SMTP_USER, SMTP_PASS, and SMTP_FROM in .env`,
      );
    }
  }

  get frontendUrl() {
    return this.config.get('FRONTEND_URL', { infer: true });
  }

  async sendOtp(
    email: string,
    code: string,
    purpose: OtpPurpose,
  ): Promise<void> {
    const subject = `Ingobyi Academy — ${purpose.replace(/_/g, ' ').toLowerCase()}`;
    await this.send(email, subject, templates.otpEmail(purpose, code), {
      devLog: `OTP ${purpose}: ${code}`,
    });
  }

  async sendOrgInvite(
    email: string,
    orgName: string,
    role: string,
    token: string,
  ) {
    const url = `${this.frontendUrl}/invite/${token}`;
    await this.send(
      email,
      `Invitation to ${orgName}`,
      templates.inviteEmail(orgName, role, url),
    );
  }

  async sendJoinRequest(
    adminEmail: string,
    orgName: string,
    requesterName: string,
  ) {
    const url = `${this.frontendUrl}/admin/join-requests`;
    await this.send(
      adminEmail,
      `New join request — ${orgName}`,
      templates.joinRequestEmail(orgName, requesterName, url),
    );
  }

  async sendJoinDecision(email: string, orgName: string, approved: boolean) {
    await this.send(
      email,
      approved ? `Welcome to ${orgName}` : `Join request update — ${orgName}`,
      templates.joinDecisionEmail(orgName, approved),
    );
  }

  async sendEnrollment(email: string, courseTitle: string, courseId: string) {
    const url = `${this.frontendUrl}/student/learn?courseId=${courseId}`;
    await this.send(
      email,
      `Enrolled in ${courseTitle}`,
      templates.enrollmentEmail(courseTitle, url),
    );
  }

  async sendAssignmentGraded(
    email: string,
    title: string,
    score: number,
    feedback?: string,
  ) {
    await this.send(
      email,
      `Graded: ${title}`,
      templates.gradedEmail(title, score, feedback),
    );
  }

  async sendCertificate(
    email: string,
    courseTitle: string,
    verifyCode: string,
  ) {
    const url = `${this.frontendUrl}/student/certificates`;
    await this.send(
      email,
      `Certificate — ${courseTitle}`,
      templates.certificateEmail(courseTitle, verifyCode, url),
    );
  }

  async sendReportNew(
    adminEmail: string,
    title: string,
    reporterEmail: string,
  ) {
    const url = `${this.frontendUrl}/admin/moderation`;
    await this.send(
      adminEmail,
      `New report: ${title}`,
      templates.reportNewEmail(title, reporterEmail, url),
    );
  }

  async sendReportResolved(email: string, title: string, status: string) {
    await this.send(
      email,
      `Report ${status.toLowerCase()}`,
      templates.reportResolvedEmail(title, status),
    );
  }

  async sendNotification(
    email: string,
    title: string,
    body: string,
    link?: string,
  ) {
    await this.send(
      email,
      title,
      templates.notificationEmail(title, body, link),
    );
  }

  async send(
    email: string,
    subject: string,
    html: string,
    opts?: { devLog?: string },
  ): Promise<void> {
    const from =
      this.config.get('SMTP_FROM', { infer: true }) ?? 'noreply@ingobyi.com';

    if (!this.transporter) {
      if (opts?.devLog) {
        this.logger.warn(
          `[DEV EMAIL] To: ${email} | ${subject} | ${opts.devLog}`,
        );
      } else {
        this.logger.warn(
          `Email skipped (SMTP not configured): ${email} — ${subject}`,
        );
      }
      return;
    }

    try {
      await this.transporter.sendMail({ from, to: email, subject, html });
      this.logger.log(`Email sent: ${email} — ${subject}`);
    } catch (err) {
      this.logger.error(
        `Failed to send email to ${email}: ${(err as Error).message}`,
      );
      if (opts?.devLog) this.logger.warn(`[FALLBACK] ${opts.devLog}`);
    }
  }
}
