import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { sendMail, logError } = vi.hoisted(() => ({ sendMail: vi.fn(), logError: vi.fn() }));

vi.mock('nodemailer', () => ({
  default: { createTransport: () => ({ sendMail }) },
}));
vi.mock('@/server/observability', () => ({
  logger: { error: logError },
}));

import emailService, { EmailUnavailableError } from '@/server/services/emailService';

describe('emailService.send', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const name of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM']) {
      vi.stubEnv(name, name === 'SMTP_PORT' ? '587' : `test-${name}`);
    }
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('rethrows a transport failure as a 503 with the transport error as its cause', async () => {
    const transportError = new Error('connect ECONNREFUSED');
    sendMail.mockRejectedValue(transportError);

    const sending = emailService.send({ to: 'a@b.c', subject: 's', text: 't', html: 'h' });

    await expect(sending).rejects.toBeInstanceOf(EmailUnavailableError);
    await expect(sending).rejects.toMatchObject({
      status: 503,
      code: 'EMAIL_UNAVAILABLE',
      cause: transportError,
    });
  });

  it('refuses as a 503 without sending when an SMTP variable is unset', async () => {
    vi.stubEnv('SMTP_FROM', '');

    const sending = emailService.send({ to: 'a@b.c', subject: 's', text: 't', html: 'h' });

    await expect(sending).rejects.toMatchObject({
      status: 503,
      code: 'EMAIL_UNAVAILABLE',
      cause: new Error('Missing required environment variable: SMTP_FROM'),
    });
    expect(sendMail).not.toHaveBeenCalled();
    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'a@b.c', subject: 's' }),
      'Failed to send email',
    );
  });
});

describe('emailService.assertConfigured', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('refuses as a 503 naming the unset SMTP variable', () => {
    vi.stubEnv('SMTP_HOST', 'smtp.test');
    vi.stubEnv('SMTP_PORT', '587');
    vi.stubEnv('SMTP_USER', 'user');
    vi.stubEnv('SMTP_PASS', '');
    vi.stubEnv('SMTP_FROM', 'noreply@test');

    expect(() => emailService.assertConfigured()).toThrow(
      expect.objectContaining({
        status: 503,
        code: 'EMAIL_UNAVAILABLE',
        cause: new Error('Missing required environment variable: SMTP_PASS'),
      }),
    );
  });
});
