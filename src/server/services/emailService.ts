import nodemailer from 'nodemailer';
import { lazy } from '@/server/lib/lazy';
import { optionalEnv, requireEnv } from '@/server/env';
import { HttpError } from '@/server/http/errors';
import { logger } from '@/server/observability';

const SMTP_ENV_VARS = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'];

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
    const missing = SMTP_ENV_VARS.filter((name) => !optionalEnv(name));
    if (missing.length > 0) {
      throw new EmailUnavailableError({ cause: new Error(`Missing ${missing.join(', ')}`) });
    }
  }

  private getTransporter = lazy(() =>
    nodemailer.createTransport({
      host: requireEnv('SMTP_HOST'),
      port: Number(requireEnv('SMTP_PORT')),
      secure: optionalEnv('SMTP_SECURE') === 'true',
      auth: {
        user: requireEnv('SMTP_USER'),
        pass: requireEnv('SMTP_PASS'),
      },
    }),
  );

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
    this.assertConfigured();
    try {
      await this.getTransporter().sendMail({
        from: requireEnv('SMTP_FROM'),
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
}

const emailService = new EmailService();
export default emailService;
