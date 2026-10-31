import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { sendMail } = vi.hoisted(() => ({ sendMail: vi.fn() }));

vi.mock('nodemailer', () => ({
  default: { createTransport: () => ({ sendMail }) },
}));
vi.mock('@/server/observability', () => ({
  logger: { error: vi.fn() },
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

  it('refuses before touching the transport when an SMTP variable is unset', async () => {
    vi.stubEnv('SMTP_PASS', '');

    const sending = emailService.send({ to: 'a@b.c', subject: 's', text: 't', html: 'h' });

    await expect(sending).rejects.toMatchObject({ status: 503, code: 'EMAIL_UNAVAILABLE' });
    await expect(sending).rejects.toMatchObject({ cause: new Error('Missing SMTP_PASS') });
    expect(sendMail).not.toHaveBeenCalled();
  });
});
