import nodemailer from 'nodemailer';
import { lazy } from '@/server/lib/lazy';
import { optionalEnv, requireEnv } from '@/server/env';
import { HttpError } from '@/server/http/errors';
import { logger } from '@/server/observability';

/** Unset SMTP and a failed send read alike to the caller: nothing was mailed. */
export class EmailUnavailableError extends HttpError {
  public constructor(options: ErrorOptions) {
    super(503, 'Email could not be sent. Please try again later.', 'EMAIL_UNAVAILABLE', options);
  }
}

export type EmailAttachment = {
  filename: string;
  content: Buffer;
  contentType: string;
};

class EmailService {
  public assertConfigured(): void {
    try {
      this.readSmtpConfig();
    } catch (err) {
      throw new EmailUnavailableError({ cause: err });
    }
  }

  public async send({
    to,
    subject,
    text,
    html,
    attachments,
  }: {
    to: string;
    subject: string;
    text: string;
    html: string;
    attachments?: EmailAttachment[];
  }) {
    try {
      await this.getTransporter().sendMail({
        from: this.readSmtpConfig().from,
        to,
        subject,
        text,
        html,
        attachments,
      });
    } catch (err) {
      // Body is deliberately not logged — report emails carry the user's
      // full transaction list.
      logger.error({ err, to, subject }, 'Failed to send email');
      throw new EmailUnavailableError({ cause: err });
    }
  }

  private getTransporter = lazy(() => {
    const { host, port, secure, user, pass } = this.readSmtpConfig();
    return nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
  });

  private readSmtpConfig() {
    return {
      host: requireEnv('SMTP_HOST'),
      port: Number(requireEnv('SMTP_PORT')),
      secure: optionalEnv('SMTP_SECURE') === 'true',
      user: requireEnv('SMTP_USER'),
      pass: requireEnv('SMTP_PASS'),
      from: requireEnv('SMTP_FROM'),
    };
  }
}

const emailService = new EmailService();
export default emailService;
