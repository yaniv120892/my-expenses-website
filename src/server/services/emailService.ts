import nodemailer from 'nodemailer';
import { lazy } from '@/server/lib/lazy';
import logger from '@/server/logging/logger';

class EmailService {
  private getTransporter = lazy(() =>
    nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    }),
  );

  public async send({
    to,
    subject,
    text,
    html,
  }: {
    to: string;
    subject: string;
    text: string;
    html: string;
  }) {
    try {
      await this.getTransporter().sendMail({
        from: process.env.SMTP_FROM,
        to,
        subject,
        text,
        html,
      });
    } catch (err) {
      logger.error({ err, to, subject, text }, 'Failed to send email');
      throw new Error('Failed to send email');
    }
  }
}

export default new EmailService();
