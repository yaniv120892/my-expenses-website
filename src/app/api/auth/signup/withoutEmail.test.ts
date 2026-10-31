import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as RateLimitModule from '@/server/http/rateLimit';
import type * as NextServerModule from 'next/server';
import { NextRequest } from 'next/server';

const { enforceRateLimits, users, redis, sendMail, scheduleOpsAlert } = vi.hoisted(() => ({
  enforceRateLimits: vi.fn(),
  users: { findByEmailOrUsername: vi.fn(), createUser: vi.fn() },
  redis: { setValue: vi.fn(), getValue: vi.fn() },
  sendMail: vi.fn(),
  scheduleOpsAlert: vi.fn(),
}));

vi.mock('@/server/http/rateLimit', async () => ({
  ...(await vi.importActual<typeof RateLimitModule>('@/server/http/rateLimit')),
  enforceRateLimits,
}));
vi.mock('@/server/repositories/userRepository', () => ({ default: users }));
vi.mock('@/server/services/announcementService', () => ({
  default: { acknowledgeAllForNewUser: vi.fn() },
}));
vi.mock('@/server/redis', () => redis);
vi.mock('nodemailer', () => ({ default: { createTransport: () => ({ sendMail }) } }));
vi.mock('@/server/observability', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  observability: { scheduleOpsAlert },
}));
vi.mock('next/server', async () => ({
  ...(await vi.importActual<typeof NextServerModule>('next/server')),
  after: vi.fn(),
}));

import { POST } from '@/app/api/auth/signup/route';

const SMTP_ENV = {
  SMTP_HOST: 'smtp.test',
  SMTP_PORT: '587',
  SMTP_USER: 'user',
  SMTP_PASS: 'pass',
  SMTP_FROM: 'noreply@test',
};

const EMAIL_UNAVAILABLE = {
  error: 'Email could not be sent. Please try again later.',
  message: 'Email could not be sent. Please try again later.',
  code: 'EMAIL_UNAVAILABLE',
};

function signup(): Promise<Response> {
  return POST(
    new NextRequest('http://localhost/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email: 'new@example.com', password: 'longenough' }),
      headers: { 'content-type': 'application/json' },
    }),
    { params: Promise.resolve(undefined) },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('WEBSITE_URL', 'https://app.test');
  for (const name of Object.keys(SMTP_ENV)) {
    vi.stubEnv(name, '');
  }
  users.findByEmailOrUsername.mockResolvedValue(null);
  users.createUser.mockResolvedValue({ id: 'user-1' });
  redis.getValue.mockResolvedValue(null);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('POST /api/auth/signup when email cannot be sent', () => {
  it('answers 503 and creates no account while SMTP is unset', async () => {
    const response = await signup();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual(EMAIL_UNAVAILABLE);
    expect(users.findByEmailOrUsername).not.toHaveBeenCalled();
    expect(users.createUser).not.toHaveBeenCalled();
    expect(redis.setValue).not.toHaveBeenCalled();
    // A server misconfiguration, so the operator hears about it.
    expect(scheduleOpsAlert).toHaveBeenCalledTimes(1);
  });

  it('answers the same 503 for a pending address re-signing up', async () => {
    users.findByEmailOrUsername.mockResolvedValue({
      id: 'user-1',
      email: 'new@example.com',
      verified: false,
    });

    const response = await signup();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual(EMAIL_UNAVAILABLE);
  });

  it('answers the same 503 when the configured transport fails', async () => {
    for (const [name, value] of Object.entries(SMTP_ENV)) {
      vi.stubEnv(name, value);
    }
    sendMail.mockRejectedValue(new Error('connect ECONNREFUSED'));

    const response = await signup();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual(EMAIL_UNAVAILABLE);
  });
});
