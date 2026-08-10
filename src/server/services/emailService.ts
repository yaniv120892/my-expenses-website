import nodemailer from 'nodemailer';
import { lazy } from '@/server/lib/lazy';
import { optionalEnv, requireEnv } from '@/server/env';
import logger from '@/server/logging/logger';

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

class EmailService {
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
      throw new Error('Failed to send email');
    }
  }
}

export default new EmailService();
