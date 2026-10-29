import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { sendMail } = vi.hoisted(() => ({ sendMail: vi.fn() }));

vi.mock('nodemailer', () => ({
  default: { createTransport: () => ({ sendMail }) },
}));
vi.mock('@/server/observability', () => ({
  logger: { error: vi.fn() },
}));

import emailService from '@/server/services/emailService';

describe('emailService.send', () => {
  beforeEach(() => {
    for (const name of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM']) {
      vi.stubEnv(name, name === 'SMTP_PORT' ? '587' : `test-${name}`);
    }
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('rethrows a transport failure with a neutral message and the transport error as its cause', async () => {
    const transportError = new Error('connect ECONNREFUSED');
    sendMail.mockRejectedValue(transportError);

    const sending = emailService.send({ to: 'a@b.c', subject: 's', text: 't', html: 'h' });

    await expect(sending).rejects.toThrow('Failed to send email');
    await expect(sending).rejects.toMatchObject({ cause: transportError });
  });
});
