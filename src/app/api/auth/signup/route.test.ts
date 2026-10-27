import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as RateLimitModule from '@/server/http/rateLimit';
import type * as NextServerModule from 'next/server';
import { NextRequest } from 'next/server';

const { enforceRateLimits, signupUser } = vi.hoisted(() => ({
  enforceRateLimits: vi.fn(),
  signupUser: vi.fn(),
}));

vi.mock('@/server/http/rateLimit', async () => ({
  ...(await vi.importActual<typeof RateLimitModule>('@/server/http/rateLimit')),
  enforceRateLimits,
}));
vi.mock('@/server/services/authService', () => ({ default: { signupUser } }));
vi.mock('@/server/logging/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/server/logging/betterStackStream', () => ({
  flushRemoteLogs: vi.fn(),
  betterStackStream: { write: vi.fn() },
}));
vi.mock('next/server', async () => ({
  ...(await vi.importActual<typeof NextServerModule>('next/server')),
  after: vi.fn(),
}));

import { POST } from '@/app/api/auth/signup/route';

beforeEach(() => {
  vi.clearAllMocks();
  signupUser.mockResolvedValue({ message: 'sent' });
});

describe('POST /api/auth/signup', () => {
  // Every signup for a pending address mails it a code, so a per-IP limit
  // alone lets rotating hosts flood one inbox.
  it('limits signups per address as well as per host', async () => {
    const request = new NextRequest('http://localhost/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        email: 'Owner@Example.com',
        password: 'longenough',
      }),
      headers: { 'content-type': 'application/json' },
    });

    await POST(request, { params: Promise.resolve(undefined) });

    const [rules] = enforceRateLimits.mock.calls[0] ?? [];
    const perAddress = rules.find(
      (rule: { key: string }) => rule.key === 'signup:email:owner@example.com',
    );
    const perHost = rules.find((rule: { key: string }) => rule.key.startsWith('signup:ip:'));
    expect(perAddress).toBeDefined();
    // A stranger can spend the address's quota, so it must outlast one host's.
    expect(perAddress.limit).toBeGreaterThan(perHost.limit);
  });
});
