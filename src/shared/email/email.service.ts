import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { EnvConfig } from '../../config/configuration';
import * as templates from './email.templates';

export type OtpPurpose = 'VERIFY_EMAIL' | 'RESET_PASSWORD';

export class EmailDeliveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmailDeliveryError';
  }
}

const RESEND_API_URL = 'https://api.resend.com/emails';

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private readonly apiKey: string | undefined;
  private readonly fromAddress: string;
  private smtpTransport: Transporter | null = null;

  constructor(private readonly config: ConfigService<EnvConfig, true>) {
    this.apiKey = config.get('RESEND_API_KEY', { infer: true });
    this.fromAddress =
      config.get('EMAIL_FROM', { infer: true }) ??
      'Ingobyi Academy <onboarding@resend.dev>';
  }

  async onModuleInit(): Promise<void> {
    if (this.apiKey) {
      this.logger.log(`Resend email ready (from: ${this.fromAddress})`);
    }

    const host = this.config.get('SMTP_HOST', { infer: true });
    const user = this.config.get('SMTP_USER', { infer: true });
    const pass = this.config.get('SMTP_PASS', { infer: true });
    const port = this.config.get('SMTP_PORT', { infer: true });

    if (host && user && pass) {
      const isGmail =
        host === 'smtp.gmail.com' || host.endsWith('.gmail.com');
      this.smtpTransport = nodemailer.createTransport(
        isGmail
          ? {
              service: 'gmail',
              auth: { user, pass },
            }
          : {
              host,
              port,
              secure: port === 465,
              requireTLS: port === 587,
              auth: { user, pass },
              connectionTimeout: 8_000,
              greetingTimeout: 8_000,
              socketTimeout: 12_000,
            },
      );
      try {
        await this.smtpTransport.verify();
        this.logger.log(`SMTP email ready (from: ${this.fromAddress})`);
      } catch (err) {
        const message = (err as Error).message;
        if (this.config.get('NODE_ENV', { infer: true }) === 'development') {
          this.logger.warn(
            `SMTP verify failed (sends will be attempted): ${message}`,
          );
        } else {
          this.logger.error(`SMTP connection failed: ${message}`);
          this.smtpTransport = null;
        }
      }
      return;
    }

    if (!this.apiKey) {
      this.logger.error(
        'No email provider configured — set RESEND_API_KEY or SMTP_HOST/SMTP_USER/SMTP_PASS',
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
    if (this.config.get('NODE_ENV', { infer: true }) === 'development') {
      this.logger.warn(`[DEV] OTP for ${email} (${purpose}): ${code}`);
    }
    const label = purpose === 'VERIFY_EMAIL' ? 'verify your email' : 'reset your password';
    const subject = `Your Ingobyi Academy code: ${code}`;
    const html = templates.otpEmail(purpose, code);
    const text = `Your Ingobyi Academy verification code is ${code}. Use it to ${label}. It expires in 10 minutes.`;
    await this.sendOrThrow(email, subject, html, text);
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

  /** Best-effort send for non-critical mail (logs errors, does not throw). */
  async send(email: string, subject: string, html: string): Promise<void> {
    try {
      await this.sendOrThrow(email, subject, html);
    } catch (err) {
      this.logger.error(
        `Email not sent: ${email} — ${subject}: ${(err as Error).message}`,
      );
    }
  }

  /** OTP and other critical mail — throws when delivery fails. */
  async sendOrThrow(
    email: string,
    subject: string,
    html: string,
    text?: string,
  ): Promise<void> {
    const errors: string[] = [];

    if (this.apiKey) {
      try {
        await this.sendViaResend(email, subject, html, text);
        return;
      } catch (err) {
        const message = (err as Error).message;
        errors.push(`Resend: ${message}`);
        this.logger.warn(`Resend failed for ${email}: ${message}`);
      }
    }

    if (this.smtpTransport) {
      try {
        await this.sendViaSmtp(email, subject, html, text);
        return;
      } catch (err) {
        const message = (err as Error).message;
        errors.push(`SMTP: ${message}`);
        this.logger.error(`SMTP failed for ${email}: ${message}`);
      }
    }

    if (!this.apiKey && !this.smtpTransport) {
      throw new EmailDeliveryError(
        'Email is not configured on the server. Contact support or try again later.',
      );
    }

    throw new EmailDeliveryError(
      errors.join(' | ') || 'Could not deliver email',
    );
  }

  private async sendViaResend(
    email: string,
    subject: string,
    html: string,
    text?: string,
  ): Promise<void> {
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
        ...(text ? { text } : {}),
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`HTTP ${response.status}: ${body}`);
    }

    this.logger.log(`Email sent via Resend: ${email} — ${subject}`);
  }

  private async sendViaSmtp(
    email: string,
    subject: string,
    html: string,
    text?: string,
  ): Promise<void> {
    await this.smtpTransport!.sendMail({
      from: this.fromAddress,
      to: email,
      subject,
      html,
      ...(text ? { text } : {}),
    });
    this.logger.log(`Email sent via SMTP: ${email} — ${subject}`);
  }
}
