import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvConfig } from '../../config/configuration';
import * as templates from './email.templates';

export type OtpPurpose = 'VERIFY_EMAIL' | 'RESET_PASSWORD';

const RESEND_API_URL = 'https://api.resend.com/emails';

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private readonly apiKey: string | undefined;
  private readonly fromAddress: string;

  constructor(private readonly config: ConfigService<EnvConfig, true>) {
    this.apiKey = config.get('RESEND_API_KEY', { infer: true });
    this.fromAddress =
      config.get('EMAIL_FROM', { infer: true }) ??
      'Ingobyi Academy <onboarding@resend.dev>';
  }

  async onModuleInit(): Promise<void> {
    if (!this.apiKey) {
      this.logger.error(
        'RESEND_API_KEY is not set — emails (OTP, notifications) will not be sent',
      );
      return;
    }
    this.logger.log(`Resend email ready (from: ${this.fromAddress})`);
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
    await this.send(email, subject, templates.otpEmail(purpose, code));
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

  async send(email: string, subject: string, html: string): Promise<void> {
    if (!this.apiKey) {
      this.logger.error(`Email not sent (Resend not configured): ${email} — ${subject}`);
      return;
    }

    try {
      const response = await fetch(RESEND_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.fromAddress,
          to: [email],
          subject,
          html,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Resend HTTP ${response.status}: ${body}`);
      }

      this.logger.log(`Email sent via Resend: ${email} — ${subject}`);
    } catch (err) {
      this.logger.error(
        `Failed to send email to ${email}: ${(err as Error).message}`,
      );
    }
  }
}
